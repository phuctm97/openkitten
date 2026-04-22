import { randomUUID } from "node:crypto";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { Job } from "bunqueue/client";
import { Bunqueue } from "bunqueue/client";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import type { Bot } from "grammy";
import type { Database } from "~/lib/database";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { logger } from "~/lib/logger";
import {
  scheduleRun as scheduleRunTable,
  schedule as scheduleTable,
} from "~/lib/schema";

const noReportMarker = "[NO_REPORT]";

const promptPrefix = `[Scheduled Task] You MUST end with a final text response after using any tools. If there is nothing meaningful to report to the user, respond with exactly: ${noReportMarker}\nOtherwise, provide a concise report for the user.\n\n`;

const defaultMaxRuntimeMs = 15 * 60 * 1000;

const pollIntervalMs = 2000;

const pollTimeoutMs = 30_000;

const maxRunsPerSchedule = 500;

const pollTimeoutSymbol = Symbol("pollTimeout");

type ScheduleRow = typeof scheduleTable.$inferSelect;

type RunRow = typeof scheduleRunTable.$inferSelect;

interface TaskData {
  readonly scheduleId: string;
  readonly runId?: string;
}

function parseOverlap(value: string): Scheduler.Overlap {
  switch (value) {
    case "queue":
    case "skip":
    case "cancel_previous":
      return value;
    default:
      throw new Error(`Invalid overlap value: ${value}`);
  }
}

function parseRunStatus(value: string): Scheduler.RunStatus {
  switch (value) {
    case "pending":
    case "running":
    case "reported":
    case "silent":
    case "failed":
    case "cancelled":
    case "skipped":
      return value;
    default:
      throw new Error(`Invalid run status: ${value}`);
  }
}

function parseRunTrigger(value: string): Scheduler.RunTrigger {
  switch (value) {
    case "cron":
    case "manual":
      return value;
    default:
      throw new Error(`Invalid run trigger: ${value}`);
  }
}

function toValidDate(value: number | undefined): Date | null {
  if (value === undefined) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function chatLockKey(chatId: number, threadId: number): string {
  return `${chatId}:${threadId}`;
}

export class Scheduler implements Disposable {
  readonly #bot: Bot;
  readonly #database: Database;
  readonly #opencodeClient: OpencodeClient;
  readonly #existingSessions: ExistingSessions;
  readonly #queue: Bunqueue<TaskData>;
  readonly #chatLocks = new Map<string, Promise<void>>();

  private constructor(
    bot: Bot,
    database: Database,
    opencodeClient: OpencodeClient,
    existingSessions: ExistingSessions,
  ) {
    this.#bot = bot;
    this.#database = database;
    this.#opencodeClient = opencodeClient;
    this.#existingSessions = existingSessions;
    this.#queue = new Bunqueue<TaskData>("scheduler", {
      embedded: true,
      processor: (job) => this.#processJob(job),
      concurrency: 5,
      heartbeatInterval: 10_000,
      removeOnComplete: { count: 50 },
      retry: {
        strategy: "exponential",
        maxAttempts: 3,
        delay: 5000,
      },
    });
    this.#queue.on("error", (error) => {
      logger.error("Scheduler queue error", error);
    });
  }

  async create(input: Scheduler.CreateInput): Promise<Scheduler.Task> {
    const id = randomUUID();
    const timezone = input.timezone ?? "UTC";
    const overlap = input.overlap ?? "queue";
    this.#database
      .insert(scheduleTable)
      .values({
        id,
        chatId: input.chatId,
        threadId: input.threadId ?? 0,
        description: input.description,
        prompt: input.prompt,
        cron: input.cron,
        timezone,
        once: input.once,
        enabled: true,
        overlap,
        notifyOnFailure: input.notifyOnFailure ?? false,
        maxRuntimeMs: input.maxRuntimeMs ?? null,
      })
      .run();
    try {
      await this.#register(id, input.cron, timezone, input.once);
    } catch (error) {
      this.#database
        .delete(scheduleTable)
        .where(eq(scheduleTable.id, id))
        .run();
      throw error;
    }
    return this.get(id);
  }

  get(id: string): Scheduler.Task {
    const row = this.#findSchedule(id);
    return this.#toTask(row);
  }

  list(filter: Scheduler.ListFilter = {}): Scheduler.Task[] {
    const conditions = [];
    if (filter.chatId !== undefined)
      conditions.push(eq(scheduleTable.chatId, filter.chatId));
    if (filter.threadId !== undefined)
      conditions.push(eq(scheduleTable.threadId, filter.threadId));
    if (filter.enabled !== undefined)
      conditions.push(eq(scheduleTable.enabled, filter.enabled));
    const rows = this.#database
      .select()
      .from(scheduleTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(scheduleTable.createdAt))
      .all();
    return rows.map((row) => this.#toTask(row));
  }

  async update(
    id: string,
    input: Scheduler.UpdateInput,
  ): Promise<Scheduler.Task> {
    const existing = this.#findSchedule(id);
    const next: ScheduleRow = {
      ...existing,
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.prompt !== undefined && { prompt: input.prompt }),
      ...(input.cron !== undefined && { cron: input.cron }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.overlap !== undefined && { overlap: input.overlap }),
      ...(input.notifyOnFailure !== undefined && {
        notifyOnFailure: input.notifyOnFailure,
      }),
      ...(input.maxRuntimeMs !== undefined && {
        maxRuntimeMs: input.maxRuntimeMs,
      }),
    };
    const cronChanged =
      next.cron !== existing.cron || next.timezone !== existing.timezone;
    this.#database
      .update(scheduleTable)
      .set({
        description: next.description,
        prompt: next.prompt,
        cron: next.cron,
        timezone: next.timezone,
        overlap: next.overlap,
        notifyOnFailure: next.notifyOnFailure,
        maxRuntimeMs: next.maxRuntimeMs,
      })
      .where(eq(scheduleTable.id, id))
      .run();
    try {
      if (cronChanged && existing.enabled) {
        await this.#unregister(id);
        await this.#register(id, next.cron, next.timezone, next.once);
      }
    } catch (error) {
      this.#database
        .update(scheduleTable)
        .set({
          cron: existing.cron,
          timezone: existing.timezone,
        })
        .where(eq(scheduleTable.id, id))
        .run();
      await this.#register(
        id,
        existing.cron,
        existing.timezone,
        existing.once,
      ).catch((restoreError) => {
        logger.error(
          "Failed to restore old cron after update failure",
          restoreError,
          { scheduleId: id },
        );
      });
      throw error;
    }
    return this.get(id);
  }

  async enable(id: string): Promise<Scheduler.Task> {
    const existing = this.#findSchedule(id);
    if (existing.enabled) return this.#toTask(existing);
    this.#database
      .update(scheduleTable)
      .set({ enabled: true })
      .where(eq(scheduleTable.id, id))
      .run();
    try {
      await this.#register(id, existing.cron, existing.timezone, existing.once);
    } catch (error) {
      this.#database
        .update(scheduleTable)
        .set({ enabled: false })
        .where(eq(scheduleTable.id, id))
        .run();
      throw error;
    }
    return this.get(id);
  }

  async disable(id: string): Promise<Scheduler.Task> {
    const existing = this.#findSchedule(id);
    if (!existing.enabled) return this.#toTask(existing);
    await this.#unregister(id);
    this.#database
      .update(scheduleTable)
      .set({ enabled: false })
      .where(eq(scheduleTable.id, id))
      .run();
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const existing = this.#findSchedule(id);
    if (existing.enabled) await this.#unregister(id);
    this.#cancelRunningForSchedule(id);
    this.#database.delete(scheduleTable).where(eq(scheduleTable.id, id)).run();
  }

  async deleteByChat(chatId: number, threadId: number): Promise<void> {
    const rows = this.#database
      .select({ id: scheduleTable.id, enabled: scheduleTable.enabled })
      .from(scheduleTable)
      .where(
        and(
          eq(scheduleTable.chatId, chatId),
          eq(scheduleTable.threadId, threadId),
        ),
      )
      .all();
    for (const row of rows) {
      if (row.enabled) await this.#unregister(row.id);
      this.#cancelRunningForSchedule(row.id);
    }
    this.#database
      .delete(scheduleTable)
      .where(
        and(
          eq(scheduleTable.chatId, chatId),
          eq(scheduleTable.threadId, threadId),
        ),
      )
      .run();
  }

  async trigger(id: string): Promise<Scheduler.TriggerResult> {
    const existing = this.#findSchedule(id);
    const runId = randomUUID();
    this.#database
      .insert(scheduleRunTable)
      .values({
        id: runId,
        scheduleId: existing.id,
        sessionId: this.#resolveSessionId(existing),
        trigger: "manual",
        status: "pending",
        startedAt: new Date(),
      })
      .run();
    try {
      const data: TaskData = { scheduleId: existing.id, runId };
      const job = await this.#queue.queue.add(`trigger-${existing.id}`, data);
      return {
        scheduleId: existing.id,
        runId,
        queueJobId: job.id,
        enqueuedAt: Date.now(),
      };
    } catch (error) {
      this.#database
        .delete(scheduleRunTable)
        .where(eq(scheduleRunTable.id, runId))
        .run();
      throw error;
    }
  }

  listRuns(filter: Scheduler.RunFilter): Scheduler.Run[] {
    const conditions = [];
    if (filter.scheduleId !== undefined)
      conditions.push(eq(scheduleRunTable.scheduleId, filter.scheduleId));
    if (filter.sessionId !== undefined)
      conditions.push(eq(scheduleRunTable.sessionId, filter.sessionId));
    if (filter.status !== undefined)
      conditions.push(eq(scheduleRunTable.status, filter.status));
    if (filter.trigger !== undefined)
      conditions.push(eq(scheduleRunTable.trigger, filter.trigger));
    const since = toValidDate(filter.since);
    if (since) conditions.push(gte(scheduleRunTable.startedAt, since));
    const until = toValidDate(filter.until);
    if (until) conditions.push(lte(scheduleRunTable.startedAt, until));
    const rows = this.#database
      .select()
      .from(scheduleRunTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(scheduleRunTable.startedAt))
      .limit(filter.limit ?? 50)
      .offset(filter.offset ?? 0)
      .all();
    return rows.map((row) => this.#toRun(row));
  }

  getRun(runId: string): Scheduler.Run {
    const row = this.#findRun(runId);
    return this.#toRun(row);
  }

  async cancelRun(runId: string): Promise<Scheduler.Run> {
    const row = this.#findRun(runId);
    if (row.status !== "running" && row.status !== "pending") {
      throw new Scheduler.RunNotCancellableError(runId, row.status);
    }
    if (row.queueJobId) this.#queue.cancel(row.queueJobId);
    this.#database
      .update(scheduleRunTable)
      .set({ status: "cancelled", finishedAt: new Date() })
      .where(
        and(
          eq(scheduleRunTable.id, runId),
          inArray(scheduleRunTable.status, ["running", "pending"]),
        ),
      )
      .run();
    return this.getRun(runId);
  }

  get bunqueue(): Bunqueue<TaskData> {
    return this.#queue;
  }

  #findSchedule(id: string): ScheduleRow {
    const row = this.#database.query.schedule
      .findFirst({ where: eq(scheduleTable.id, id) })
      .sync();
    if (!row) throw new Scheduler.NotFoundError(id);
    return row;
  }

  #findRun(id: string): RunRow {
    const row = this.#database.query.scheduleRun
      .findFirst({ where: eq(scheduleRunTable.id, id) })
      .sync();
    if (!row) throw new Scheduler.RunNotFoundError(id);
    return row;
  }

  #resolveSessionId(row: ScheduleRow): string | null {
    const location = {
      chatId: row.chatId,
      threadId: row.threadId || undefined,
    };
    return this.#existingSessions.find(location) ?? null;
  }

  #toTask(row: ScheduleRow): Scheduler.Task {
    return {
      id: row.id,
      chatId: row.chatId,
      threadId: row.threadId,
      description: row.description,
      prompt: row.prompt,
      cron: row.cron,
      timezone: row.timezone,
      once: row.once,
      enabled: row.enabled,
      overlap: parseOverlap(row.overlap),
      notifyOnFailure: row.notifyOnFailure,
      maxRuntimeMs: row.maxRuntimeMs,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    };
  }

  #toRun(row: RunRow): Scheduler.Run {
    return {
      id: row.id,
      scheduleId: row.scheduleId,
      sessionId: row.sessionId,
      queueJobId: row.queueJobId,
      trigger: parseRunTrigger(row.trigger),
      status: parseRunStatus(row.status),
      startedAt: row.startedAt.getTime(),
      finishedAt: row.finishedAt ? row.finishedAt.getTime() : null,
      output: row.output,
      error: row.error,
    };
  }

  async #register(
    scheduleId: string,
    cron: string,
    timezone: string,
    once: boolean,
  ): Promise<void> {
    const data: TaskData = { scheduleId };
    if (once) {
      await this.#queue.queue.upsertJobScheduler(
        scheduleId,
        { pattern: cron, limit: 1, timezone, preventOverlap: false },
        { name: scheduleId, data },
      );
    } else {
      await this.#queue.queue.upsertJobScheduler(
        scheduleId,
        { pattern: cron, timezone, preventOverlap: false },
        { name: scheduleId, data },
      );
    }
  }

  async #unregister(scheduleId: string): Promise<void> {
    await this.#queue.removeCron(scheduleId);
  }

  #cancelRunningForSchedule(scheduleId: string): void {
    const running = this.#database
      .select()
      .from(scheduleRunTable)
      .where(
        and(
          eq(scheduleRunTable.scheduleId, scheduleId),
          inArray(scheduleRunTable.status, ["running", "pending"]),
        ),
      )
      .all();
    for (const run of running) {
      if (run.queueJobId) this.#queue.cancel(run.queueJobId);
      this.#database
        .update(scheduleRunTable)
        .set({ status: "cancelled", finishedAt: new Date() })
        .where(
          and(
            eq(scheduleRunTable.id, run.id),
            inArray(scheduleRunTable.status, ["running", "pending"]),
          ),
        )
        .run();
    }
  }

  #applyOverlap(row: ScheduleRow, queueJobId: string): "proceed" | "skipped" {
    const overlap = parseOverlap(row.overlap);
    if (overlap === "queue") return "proceed";
    const running = this.#database
      .select()
      .from(scheduleRunTable)
      .where(
        and(
          eq(scheduleRunTable.scheduleId, row.id),
          eq(scheduleRunTable.status, "running"),
        ),
      )
      .all();
    if (running.length === 0) return "proceed";
    if (overlap === "skip") {
      const now = new Date();
      this.#database
        .insert(scheduleRunTable)
        .values({
          id: randomUUID(),
          scheduleId: row.id,
          sessionId: this.#resolveSessionId(row),
          queueJobId,
          trigger: "cron",
          status: "skipped",
          startedAt: now,
          finishedAt: now,
        })
        .run();
      this.#trimRetention(row.id);
      return "skipped";
    }
    for (const prev of running) {
      if (prev.queueJobId) this.#queue.cancel(prev.queueJobId);
      this.#database
        .update(scheduleRunTable)
        .set({ status: "cancelled", finishedAt: new Date() })
        .where(
          and(
            eq(scheduleRunTable.id, prev.id),
            eq(scheduleRunTable.status, "running"),
          ),
        )
        .run();
    }
    return "proceed";
  }

  #trimRetention(scheduleId: string): void {
    const rows = this.#database
      .select({ id: scheduleRunTable.id })
      .from(scheduleRunTable)
      .where(eq(scheduleRunTable.scheduleId, scheduleId))
      .orderBy(desc(scheduleRunTable.startedAt))
      .all();
    if (rows.length <= maxRunsPerSchedule) return;
    const toDelete = rows.slice(maxRunsPerSchedule).map((r) => r.id);
    this.#database
      .delete(scheduleRunTable)
      .where(inArray(scheduleRunTable.id, toDelete))
      .run();
  }

  async #withChatLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.#chatLocks.get(key) ?? Promise.resolve();
    const { promise: done, resolve } = Promise.withResolvers<void>();
    this.#chatLocks.set(key, done);
    try {
      await prev;
      return await fn();
    } finally {
      resolve();
      if (this.#chatLocks.get(key) === done) {
        this.#chatLocks.delete(key);
      }
    }
  }

  async #processJob(job: Job<TaskData>): Promise<void> {
    const isManualTrigger = job.name.startsWith("trigger-");
    const requestedId = job.data?.scheduleId;
    if (!requestedId) {
      logger.warn("Scheduler job missing scheduleId", {
        jobId: job.id,
        jobName: job.name,
        data: job.data,
      });
      return;
    }
    const scheduleRow = this.#database.query.schedule
      .findFirst({ where: eq(scheduleTable.id, requestedId) })
      .sync();
    if (!scheduleRow) {
      logger.warn("Scheduled task no longer exists, skipping job", {
        jobId: job.id,
        scheduleId: requestedId,
      });
      return;
    }
    if (!scheduleRow.enabled && !isManualTrigger) return;
    if (!isManualTrigger) {
      const decision = this.#applyOverlap(scheduleRow, job.id);
      if (decision === "skipped") return;
    }
    await this.#withChatLock(
      chatLockKey(scheduleRow.chatId, scheduleRow.threadId),
      async () => {
        const existingRunId = job.data?.runId;
        let runId: string;
        if (existingRunId) {
          const claimed = this.#database
            .update(scheduleRunTable)
            .set({
              status: "running",
              queueJobId: job.id,
              startedAt: new Date(),
            })
            .where(
              and(
                eq(scheduleRunTable.id, existingRunId),
                eq(scheduleRunTable.status, "pending"),
              ),
            )
            .returning({ id: scheduleRunTable.id })
            .all();
          if (claimed.length === 0) return;
          runId = existingRunId;
        } else {
          runId = randomUUID();
          this.#database
            .insert(scheduleRunTable)
            .values({
              id: runId,
              scheduleId: scheduleRow.id,
              sessionId: this.#resolveSessionId(scheduleRow),
              queueJobId: job.id,
              trigger: isManualTrigger ? "manual" : "cron",
              status: "running",
              startedAt: new Date(),
            })
            .run();
        }
        try {
          await this.#executeRun(scheduleRow, runId, job);
        } finally {
          this.#trimRetention(scheduleRow.id);
          if (scheduleRow.once && !isManualTrigger) {
            this.#database
              .update(scheduleTable)
              .set({ enabled: false })
              .where(eq(scheduleTable.id, scheduleRow.id))
              .run();
            await this.#queue.removeCron(scheduleRow.id).catch((error) => {
              logger.warn(
                "Failed to remove cron for completed once-task",
                error,
                {
                  scheduleId: scheduleRow.id,
                },
              );
            });
          }
        }
      },
    );
  }

  async #executeRun(
    scheduleRow: ScheduleRow,
    runId: string,
    job: Job<TaskData>,
  ): Promise<void> {
    const sendOptions = scheduleRow.threadId
      ? { message_thread_id: scheduleRow.threadId }
      : {};
    const signal = this.#queue.getSignal(job.id);
    let ephemeralId: string | undefined;
    try {
      const created = await this.#opencodeClient.session.create(
        {},
        { throwOnError: true },
      );
      ephemeralId = created.data.id;
      if (signal?.aborted) {
        this.#finalizeRun(runId, "cancelled", null, null);
        return;
      }
      const userSessionId = this.#resolveSessionId(scheduleRow);
      const agent = userSessionId
        ? getSessionAgent(this.#database, userSessionId)
        : undefined;
      await this.#opencodeClient.session.promptAsync(
        {
          sessionID: ephemeralId,
          ...(agent && { agent }),
          parts: [
            { type: "text", text: `${promptPrefix}${scheduleRow.prompt}` },
          ],
        },
        { throwOnError: true },
      );
      const text = await this.#waitForText(ephemeralId, scheduleRow, signal);
      if (signal?.aborted) {
        this.#finalizeRun(runId, "cancelled", text, null);
        return;
      }
      if (!text || text.trim() === noReportMarker) {
        this.#finalizeRun(runId, "silent", text, null);
        return;
      }
      await this.#bot.api.sendMessage(scheduleRow.chatId, text, sendOptions);
      this.#finalizeRun(runId, "reported", text, null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.#finalizeRun(runId, "failed", null, message);
      if (scheduleRow.notifyOnFailure) {
        await this.#bot.api
          .sendMessage(
            scheduleRow.chatId,
            `⚠️ Scheduled task "${scheduleRow.description}" failed: ${message}`,
            sendOptions,
          )
          .catch((notifyError) => {
            logger.error(
              "Failed to deliver failure notification",
              notifyError,
              { runId },
            );
          });
      }
      throw error;
    } finally {
      if (ephemeralId) {
        await this.#opencodeClient.session
          .abort({ sessionID: ephemeralId })
          .catch((error) => {
            logger.warn("Failed to abort ephemeral session", error, {
              ephemeralId,
            });
          });
      }
    }
  }

  #finalizeRun(
    runId: string,
    status: Scheduler.RunStatus,
    output: string | null,
    error: string | null,
  ): void {
    this.#database
      .update(scheduleRunTable)
      .set({
        status,
        output,
        error,
        finishedAt: new Date(),
      })
      .where(eq(scheduleRunTable.id, runId))
      .run();
  }

  async #waitForText(
    sessionId: string,
    scheduleRow: ScheduleRow,
    signal: AbortSignal | null,
  ): Promise<string | null> {
    const maxRuntime = scheduleRow.maxRuntimeMs ?? defaultMaxRuntimeMs;
    const maxAttempts = Math.max(1, Math.ceil(maxRuntime / pollIntervalMs));
    for (let i = 0; i < maxAttempts; i++) {
      if (signal?.aborted) return null;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      if (signal?.aborted) return null;
      try {
        const result = await this.#pollOnce(sessionId, pollTimeoutMs);
        if (result === "busy") continue;
        if (result === "idle") break;
        if (result) return result;
      } catch (error) {
        logger.warn("Background poll iteration failed, retrying", error, {
          scheduleId: scheduleRow.id,
          attempt: i,
        });
      }
    }
    return null;
  }

  async #pollOnce(
    sessionId: string,
    timeoutMs: number,
  ): Promise<string | "busy" | "idle" | null> {
    let timer: Timer | undefined;
    const result = await Promise.race([
      this.#pollSession(sessionId),
      new Promise<typeof pollTimeoutSymbol>((resolve) => {
        timer = setTimeout(resolve, timeoutMs, pollTimeoutSymbol);
      }),
    ]);
    clearTimeout(timer);
    if (result === pollTimeoutSymbol) throw new Error("Poll timeout");
    return result;
  }

  async #pollSession(
    sessionId: string,
  ): Promise<string | "busy" | "idle" | null> {
    const { data: statuses } = await this.#opencodeClient.session.status(
      {},
      { throwOnError: true },
    );
    const status = statuses[sessionId];
    if (status && status.type === "busy") return "busy";
    const { data: messages } = await this.#opencodeClient.session.messages(
      { sessionID: sessionId },
      { throwOnError: true },
    );
    for (const msg of [...messages].reverse()) {
      if (msg.info.role !== "assistant") continue;
      const text = msg.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
      if (text) return text;
    }
    if (status?.type === "idle") return "idle";
    return null;
  }

  async #recover(): Promise<void> {
    const stuck = this.#database
      .update(scheduleRunTable)
      .set({
        status: "failed",
        error: "bot restart",
        finishedAt: new Date(),
      })
      .where(inArray(scheduleRunTable.status, ["running", "pending"]))
      .returning({ id: scheduleRunTable.id })
      .all();
    if (stuck.length > 0) {
      logger.info("Finalized stuck scheduled runs on recovery", {
        count: stuck.length,
      });
    }
    const rows = this.#database
      .select()
      .from(scheduleTable)
      .where(eq(scheduleTable.enabled, true))
      .all();
    const registered = new Set(
      (await this.#queue.listCrons()).map((c) => c.id),
    );
    for (const row of rows) {
      if (registered.has(row.id)) continue;
      await this.#register(row.id, row.cron, row.timezone, row.once);
    }
    if (rows.length > 0) {
      logger.info("Recovered scheduled tasks", { count: rows.length });
    }
  }

  [Symbol.dispose](): void {
    this.#queue.close().catch((error) => {
      logger.error("Failed to close scheduler queue", error);
    });
    logger.info("Scheduler is terminated");
  }

  static readonly NotFoundError = class NotFoundError extends Error {
    readonly id: string;
    constructor(id: string) {
      super(`Scheduled task not found: ${id}`);
      this.id = id;
    }
  };

  static readonly RunNotFoundError = class RunNotFoundError extends Error {
    readonly id: string;
    constructor(id: string) {
      super(`Scheduled run not found: ${id}`);
      this.id = id;
    }
  };

  static readonly RunNotCancellableError =
    class RunNotCancellableError extends Error {
      readonly id: string;
      readonly status: string;
      constructor(id: string, status: string) {
        super(`Scheduled run ${id} is not cancellable (status: ${status})`);
        this.id = id;
        this.status = status;
      }
    };

  static async create(
    bot: Bot,
    database: Database,
    opencodeClient: OpencodeClient,
    existingSessions: ExistingSessions,
  ): Promise<Scheduler> {
    const scheduler = new Scheduler(
      bot,
      database,
      opencodeClient,
      existingSessions,
    );
    for (const location of existingSessions.unreachableLocations) {
      await scheduler.deleteByChat(location.chatId, location.threadId);
    }
    await scheduler.#recover();
    logger.info("Scheduler started");
    return scheduler;
  }
}

export namespace Scheduler {
  export type Overlap = "queue" | "skip" | "cancel_previous";

  export type RunStatus =
    | "pending"
    | "running"
    | "reported"
    | "silent"
    | "failed"
    | "cancelled"
    | "skipped";

  export type RunTrigger = "cron" | "manual";

  export interface CreateInput {
    readonly chatId: number;
    readonly threadId?: number;
    readonly cron: string;
    readonly description: string;
    readonly prompt: string;
    readonly once: boolean;
    readonly timezone?: string;
    readonly overlap?: Overlap;
    readonly notifyOnFailure?: boolean;
    readonly maxRuntimeMs?: number;
  }

  export interface UpdateInput {
    readonly description?: string;
    readonly prompt?: string;
    readonly cron?: string;
    readonly timezone?: string;
    readonly overlap?: Overlap;
    readonly notifyOnFailure?: boolean;
    readonly maxRuntimeMs?: number | null;
  }

  export interface ListFilter {
    readonly chatId?: number;
    readonly threadId?: number;
    readonly enabled?: boolean;
  }

  export interface RunFilter {
    readonly scheduleId?: string;
    readonly sessionId?: string;
    readonly status?: RunStatus;
    readonly trigger?: RunTrigger;
    readonly since?: number;
    readonly until?: number;
    readonly limit?: number;
    readonly offset?: number;
  }

  export interface TriggerResult {
    readonly scheduleId: string;
    readonly runId: string;
    readonly queueJobId: string;
    readonly enqueuedAt: number;
  }

  export interface Task {
    readonly id: string;
    readonly chatId: number;
    readonly threadId: number;
    readonly description: string;
    readonly prompt: string;
    readonly cron: string;
    readonly timezone: string;
    readonly once: boolean;
    readonly enabled: boolean;
    readonly overlap: Overlap;
    readonly notifyOnFailure: boolean;
    readonly maxRuntimeMs: number | null;
    readonly createdAt: number;
    readonly updatedAt: number;
  }

  export interface Run {
    readonly id: string;
    readonly scheduleId: string;
    readonly sessionId: string | null;
    readonly queueJobId: string | null;
    readonly trigger: RunTrigger;
    readonly status: RunStatus;
    readonly startedAt: number;
    readonly finishedAt: number | null;
    readonly output: string | null;
    readonly error: string | null;
  }
}
