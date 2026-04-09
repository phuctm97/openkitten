import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { Job, JobOptions } from "bunqueue/client";
import { Bunqueue } from "bunqueue/client";
import type { Bot } from "grammy";
import type { Database } from "~/lib/database";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { logger } from "~/lib/logger";

const sessionPromptPrefix = "[Scheduled Task] ";

const noReportMarker = "[NO_REPORT]";

const backgroundPromptPrefix = `[Scheduled Background Task] You MUST end with a final text response after using any tools. If there is nothing meaningful to report, respond with exactly: ${noReportMarker}\nOtherwise, provide a concise report for the user.\n\n`;

const validKinds: ReadonlySet<string> = new Set<Scheduler.TaskKind>([
  "session",
  "background",
]);

const maxRunHistory = 20;

interface TaskData {
  readonly taskId: string;
  readonly sessionId: string;
  readonly kind: Scheduler.TaskKind;
  readonly cron: string;
  readonly description: string;
  readonly prompt: string;
  readonly once: boolean;
}

interface TaskMeta {
  data: TaskData;
  createdAt: number;
  updatedAt: number;
  lastTriggeredAt: number | null;
  nextRunAt: number | null;
  runs: Scheduler.RunRecord[];
}

export class Scheduler implements Disposable {
  readonly #bot: Bot;
  readonly #database: Database;
  readonly #opencodeClient: OpencodeClient;
  readonly #existingSessions: ExistingSessions;
  readonly #queue: Bunqueue<TaskData>;
  readonly #tasks = new Map<string, TaskMeta>();

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
      processor: (job: Job<TaskData>) => this.#processJob(job),
      concurrency: 5,
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
    const id = crypto.randomUUID();
    const taskData: TaskData = {
      taskId: id,
      sessionId: input.sessionId,
      kind: input.kind,
      cron: input.cron,
      description: input.description,
      prompt: input.prompt,
      once: input.once,
    };
    let nextRunAt: number | null = null;
    if (input.once) {
      const info = await this.#queue.queue.upsertJobScheduler(
        id,
        { pattern: input.cron, limit: 1 },
        { name: id, data: taskData },
      );
      nextRunAt = info?.next ?? null;
    } else {
      const info = await this.#queue.cron(id, input.cron, taskData);
      nextRunAt = info?.next ?? null;
    }
    const now = Date.now();
    const meta: TaskMeta = {
      data: taskData,
      createdAt: now,
      updatedAt: now,
      lastTriggeredAt: null,
      nextRunAt,
      runs: [],
    };
    this.#tasks.set(id, meta);
    return this.#toTask(meta);
  }

  list(): Scheduler.Task[] {
    return [...this.#tasks.values()].map((meta) => this.#toTask(meta));
  }

  get(id: string): Scheduler.Task {
    const meta = this.#tasks.get(id);
    if (!meta) throw new Scheduler.NotFoundError(id);
    return this.#toTask(meta);
  }

  getRuns(id: string): Scheduler.RunRecord[] {
    const meta = this.#tasks.get(id);
    if (!meta) throw new Scheduler.NotFoundError(id);
    return [...meta.runs];
  }

  async delete(id: string): Promise<void> {
    if (!this.#tasks.has(id)) throw new Scheduler.NotFoundError(id);
    await this.#queue.removeCron(id);
    this.#tasks.delete(id);
  }

  async trigger(id: string): Promise<Scheduler.TriggerResult> {
    const meta = this.#tasks.get(id);
    if (!meta) throw new Scheduler.NotFoundError(id);
    const now = Date.now();
    meta.lastTriggeredAt = now;
    const job = await this.#queue.queue.add(
      `trigger-${meta.data.taskId}`,
      meta.data,
    );
    return {
      scheduleId: id,
      jobId: job.id,
      enqueuedAt: now,
    };
  }

  async update(
    id: string,
    input: Scheduler.UpdateInput,
  ): Promise<Scheduler.Task> {
    const meta = this.#tasks.get(id);
    if (!meta) throw new Scheduler.NotFoundError(id);
    const existing = meta.data;
    const cron = input.cron ?? existing.cron;
    const description = input.description ?? existing.description;
    const prompt = input.prompt ?? existing.prompt;
    const updated: TaskData = {
      ...existing,
      cron,
      description,
      prompt,
    };
    const cronChanged =
      input.cron !== undefined && input.cron !== existing.cron;
    const dataChanged =
      description !== existing.description || prompt !== existing.prompt;
    let nextRunAt = meta.nextRunAt;
    if (cronChanged) {
      await this.#queue.removeCron(id);
      try {
        if (existing.once) {
          const info = await this.#queue.queue.upsertJobScheduler(
            id,
            { pattern: cron, limit: 1 },
            { name: id, data: updated },
          );
          nextRunAt = info?.next ?? null;
        } else {
          const info = await this.#queue.cron(id, cron, updated);
          nextRunAt = info?.next ?? null;
        }
      } catch (error) {
        if (existing.once) {
          await this.#queue.queue
            .upsertJobScheduler(
              id,
              { pattern: existing.cron, limit: 1 },
              { name: id, data: existing },
            )
            .catch((restoreError) => {
              logger.error(
                "Failed to restore old cron after update failure",
                restoreError,
                { taskId: id },
              );
            });
        } else {
          await this.#queue
            .cron(id, existing.cron, existing)
            .catch((restoreError) => {
              logger.error(
                "Failed to restore old cron after update failure",
                restoreError,
                { taskId: id },
              );
            });
        }
        throw error;
      }
    } else if (dataChanged && !existing.once) {
      const info = await this.#queue.cron(id, cron, updated);
      nextRunAt = info?.next ?? null;
    }
    meta.data = updated;
    meta.updatedAt = Date.now();
    meta.nextRunAt = nextRunAt;
    return this.#toTask(meta);
  }

  #toTask(meta: TaskMeta): Scheduler.Task {
    const { data } = meta;
    if (!validKinds.has(data.kind))
      throw new Error(`Unknown scheduled task kind: ${data.kind}`);
    return {
      id: data.taskId,
      sessionId: data.sessionId,
      kind: data.kind,
      description: data.description,
      prompt: data.prompt,
      cron: data.cron,
      once: data.once,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      lastTriggeredAt: meta.lastTriggeredAt,
      nextRunAt: meta.nextRunAt,
      lastRun: meta.runs[meta.runs.length - 1] ?? null,
    };
  }

  async #processJob(job: Job<TaskData>): Promise<void> {
    const isManualTrigger = job.name.startsWith("trigger-");
    const existing = this.#tasks.get(job.data.taskId);
    const data = existing?.data ?? job.data;
    const meta: TaskMeta = existing ?? {
      data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastTriggeredAt: null,
      nextRunAt: null,
      runs: [],
    };
    if (!existing) {
      this.#tasks.set(data.taskId, meta);
    }
    const run: Scheduler.RunRecord = {
      jobId: job.id,
      startedAt: Date.now(),
      finishedAt: 0,
      status: "completed_silent",
      notifiedUser: false,
      output: null,
      error: null,
    };
    try {
      const result = await this.#execute(data);
      run.status = result.status;
      run.notifiedUser = result.status === "completed_notified";
      run.output = result.output;
    } catch (error) {
      run.status = "failed";
      run.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      run.finishedAt = Date.now();
      meta.runs.push(run);
      if (meta.runs.length > maxRunHistory) {
        meta.runs.splice(0, meta.runs.length - maxRunHistory);
      }
      if (data.once && !isManualTrigger) {
        this.#tasks.delete(data.taskId);
      }
    }
  }

  async #execute(
    data: TaskData,
  ): Promise<{ status: Scheduler.RunStatus; output: string | null }> {
    if (data.kind === "background") {
      return this.#executeBackground(data);
    }
    const agent = getSessionAgent(this.#database, data.sessionId);
    await this.#opencodeClient.session.promptAsync(
      {
        sessionID: data.sessionId,
        ...(agent && { agent }),
        parts: [{ type: "text", text: `${sessionPromptPrefix}${data.prompt}` }],
      },
      { throwOnError: true },
    );
    return { status: "completed_notified", output: null };
  }

  async #executeBackground(
    data: TaskData,
  ): Promise<{ status: Scheduler.RunStatus; output: string | null }> {
    const location = this.#existingSessions.get(data.sessionId);
    if (!location) {
      logger.warn("Background task session not found, skipping", {
        taskId: data.taskId,
        sessionId: data.sessionId,
      });
      return { status: "completed_silent", output: null };
    }
    const {
      data: { id: ephemeralId },
    } = await this.#opencodeClient.session.create({}, { throwOnError: true });
    try {
      await this.#opencodeClient.session.promptAsync(
        {
          sessionID: ephemeralId,
          parts: [
            {
              type: "text",
              text: `${backgroundPromptPrefix}${data.prompt}`,
            },
          ],
        },
        { throwOnError: true },
      );
      const text = await this.#waitForText(ephemeralId, data.taskId);
      if (!text || text.includes(noReportMarker)) {
        return { status: "completed_silent", output: text };
      }
      await this.#bot.api.sendMessage(location.chatId, text, {
        ...(location.threadId && { message_thread_id: location.threadId }),
      });
      return { status: "completed_notified", output: text };
    } finally {
      await this.#opencodeClient.session
        .abort({ sessionID: ephemeralId })
        .catch((error) => {
          logger.warn("Failed to abort ephemeral session", error, {
            sessionID: ephemeralId,
          });
        });
    }
  }

  async #waitForText(
    sessionId: string,
    taskId: string,
  ): Promise<string | null> {
    const maxAttempts = 90;
    const intervalMs = 2000;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      const { data: statuses } = await this.#opencodeClient.session.status(
        {},
        { throwOnError: true },
      );
      const status = statuses[sessionId];
      if (status && status.type === "busy") continue;
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
      if (status?.type === "idle") break;
    }
    logger.warn("Background task produced no text response", { taskId });
    return null;
  }

  async addJob(
    sessionId: string,
    kind: Scheduler.TaskKind,
    description: string,
    prompt: string,
    opts?: JobOptions | undefined,
  ): Promise<Job<TaskData>> {
    const taskData: TaskData = {
      taskId: crypto.randomUUID(),
      sessionId,
      kind,
      cron: "",
      description,
      prompt,
      once: true,
    };
    return this.#queue.queue.add(taskData.taskId, taskData, opts);
  }

  get bunqueue(): Bunqueue<TaskData> {
    return this.#queue;
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

  static create(
    bot: Bot,
    database: Database,
    opencodeClient: OpencodeClient,
    existingSessions: ExistingSessions,
  ): Scheduler {
    const scheduler = new Scheduler(
      bot,
      database,
      opencodeClient,
      existingSessions,
    );
    logger.info("Scheduler started");
    return scheduler;
  }
}

export namespace Scheduler {
  export type TaskKind = "session" | "background";
  export type RunStatus = "completed_notified" | "completed_silent" | "failed";

  export interface CreateInput {
    readonly sessionId: string;
    readonly kind: TaskKind;
    readonly cron: string;
    readonly description: string;
    readonly prompt: string;
    readonly once: boolean;
  }

  export interface UpdateInput {
    readonly description?: string;
    readonly prompt?: string;
    readonly cron?: string;
  }

  export interface RunRecord {
    readonly jobId: string;
    startedAt: number;
    finishedAt: number;
    status: RunStatus;
    notifiedUser: boolean;
    output: string | null;
    error: string | null;
  }

  export interface TriggerResult {
    readonly scheduleId: string;
    readonly jobId: string;
    readonly enqueuedAt: number;
  }

  export interface Task {
    readonly id: string;
    readonly sessionId: string;
    readonly kind: TaskKind;
    readonly cron: string;
    readonly description: string;
    readonly prompt: string;
    readonly once: boolean;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly lastTriggeredAt: number | null;
    readonly nextRunAt: number | null;
    readonly lastRun: RunRecord | null;
  }
}
