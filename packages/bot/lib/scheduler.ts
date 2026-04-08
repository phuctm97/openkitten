import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import type { Database } from "~/lib/database";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { logger } from "~/lib/logger";
import * as schema from "~/lib/schema";

const sessionPromptPrefix = "[Scheduled Task] ";

const noReportMarker = "[NO_REPORT]";

const backgroundPromptPrefix = `[Scheduled Background Task] You MUST end with a final text response after using any tools. If there is nothing meaningful to report, respond with exactly: ${noReportMarker}\nOtherwise, provide a concise report for the user.\n\n`;

const validKinds: ReadonlySet<string> = new Set<Scheduler.TaskKind>([
  "session",
  "background",
]);

export class Scheduler implements Disposable {
  readonly #bot: Bot;
  readonly #database: Database;
  readonly #opencodeClient: OpencodeClient;
  readonly #existingSessions: ExistingSessions;
  readonly #timers = new Map<string, Timer>();

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
  }

  async create(input: Scheduler.CreateInput): Promise<Scheduler.Task> {
    const id = crypto.randomUUID();
    this.#database
      .insert(schema.scheduledTask)
      .values({
        id,
        sessionId: input.sessionId,
        kind: input.kind,
        description: input.description,
        prompt: input.prompt,
        cron: input.cron,
        once: input.once ? 1 : 0,
      })
      .run();
    this.#startTimer(id, input.cron, input.once);
    return this.#toTask(
      id,
      input.sessionId,
      input.kind,
      input.description,
      input.prompt,
      input.cron,
      input.once,
    );
  }

  list(): Scheduler.Task[] {
    const rows = this.#database.query.scheduledTask.findMany().sync();
    return rows.map((row) =>
      this.#toTask(
        row.id,
        row.sessionId,
        row.kind,
        row.description,
        row.prompt,
        row.cron,
        row.once === 1,
      ),
    );
  }

  get(id: string): Scheduler.Task {
    const row = this.#readTask(id);
    if (!row) throw new Scheduler.NotFoundError(id);
    return this.#toTask(
      row.id,
      row.sessionId,
      row.kind,
      row.description,
      row.prompt,
      row.cron,
      row.once === 1,
    );
  }

  async delete(id: string): Promise<void> {
    const row = this.#readTask(id);
    if (!row) throw new Scheduler.NotFoundError(id);
    this.#stopTimer(id);
    this.#deleteTask(id);
  }

  async trigger(id: string): Promise<void> {
    const row = this.#readTask(id);
    if (!row) throw new Scheduler.NotFoundError(id);
    await this.#execute(row);
  }

  async update(
    id: string,
    input: Scheduler.UpdateInput,
  ): Promise<Scheduler.Task> {
    const existing = this.#readTask(id);
    if (!existing) throw new Scheduler.NotFoundError(id);
    const values: Record<string, unknown> = {};
    if (input.description !== undefined)
      values["description"] = input.description;
    if (input.prompt !== undefined) values["prompt"] = input.prompt;
    if (input.cron !== undefined) values["cron"] = input.cron;
    if (Object.keys(values).length > 0) {
      this.#database
        .update(schema.scheduledTask)
        .set(values)
        .where(eq(schema.scheduledTask.id, id))
        .run();
    }
    const cron = input.cron ?? existing.cron;
    if (input.cron !== undefined && input.cron !== existing.cron) {
      this.#stopTimer(id);
      this.#startTimer(id, cron, existing.once === 1);
    }
    return this.#toTask(
      id,
      existing.sessionId,
      existing.kind,
      input.description ?? existing.description,
      input.prompt ?? existing.prompt,
      cron,
      existing.once === 1,
    );
  }

  #toTask(
    id: string,
    sessionId: string,
    kind: string,
    description: string,
    prompt: string,
    cron: string,
    once: boolean,
  ): Scheduler.Task {
    if (!validKinds.has(kind))
      throw new Error(`Unknown scheduled task kind: ${kind}`);
    return {
      id,
      sessionId,
      kind: kind as Scheduler.TaskKind,
      description,
      prompt,
      cron,
      once,
      nextRun: this.#nextRun(cron),
    };
  }

  #readTask(id: string) {
    return this.#database.query.scheduledTask
      .findFirst({ where: eq(schema.scheduledTask.id, id) })
      .sync();
  }

  #deleteTask(id: string): void {
    this.#database
      .delete(schema.scheduledTask)
      .where(eq(schema.scheduledTask.id, id))
      .run();
  }

  #startTimer(id: string, cron: string, once: boolean): void {
    const scheduleNext = () => {
      let next: Date | null;
      try {
        next = Bun.cron.parse(cron);
      } catch {
        logger.warn("Invalid cron expression, timer not started", {
          taskId: id,
          cron,
        });
        return;
      }
      if (!next) return;
      const delay = Math.max(next.getTime() - Date.now(), 1000);
      const timer = setTimeout(async () => {
        this.#timers.delete(id);
        try {
          const task = this.#readTask(id);
          if (!task) {
            logger.debug("Timer fired for deleted task, skipping", {
              taskId: id,
            });
            return;
          }
          await this.#execute(task);
          if (once) {
            this.#deleteTask(id);
          } else {
            scheduleNext();
          }
        } catch (error) {
          logger.error("Scheduled task failed", error, { taskId: id });
          if (!once) scheduleNext();
        }
      }, delay);
      timer.unref();
      this.#timers.set(id, timer);
    };
    scheduleNext();
  }

  #stopTimer(id: string): void {
    const timer = this.#timers.get(id);
    if (timer) clearTimeout(timer);
    this.#timers.delete(id);
  }

  #nextRun(cron: string): string | null {
    try {
      const next = Bun.cron.parse(cron);
      return next ? next.toISOString() : null;
    } catch {
      return null;
    }
  }

  async #execute(
    task: typeof schema.scheduledTask.$inferSelect,
  ): Promise<void> {
    if (task.kind === "background") {
      await this.#executeBackground(task);
      return;
    }
    const agent = getSessionAgent(this.#database, task.sessionId);
    await this.#opencodeClient.session.promptAsync(
      {
        sessionID: task.sessionId,
        ...(agent && { agent }),
        parts: [{ type: "text", text: `${sessionPromptPrefix}${task.prompt}` }],
      },
      { throwOnError: true },
    );
  }

  async #executeBackground(
    task: typeof schema.scheduledTask.$inferSelect,
  ): Promise<void> {
    const location = this.#existingSessions.get(task.sessionId);
    if (!location) {
      logger.warn("Background task session not found, skipping", {
        taskId: task.id,
        sessionId: task.sessionId,
      });
      return;
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
              text: `${backgroundPromptPrefix}${task.prompt}`,
            },
          ],
        },
        { throwOnError: true },
      );
      const text = await this.#waitForText(ephemeralId, task.id);
      if (!text || text.includes(noReportMarker)) return;
      await this.#bot.api.sendMessage(location.chatId, text, {
        ...(location.threadId && { message_thread_id: location.threadId }),
      });
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
      await new Promise((r) => setTimeout(r, intervalMs));
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
      if (!status || status.type === "idle") break;
    }
    logger.warn("Background task produced no text response", { taskId });
    return null;
  }

  [Symbol.dispose](): void {
    for (const id of this.#timers.keys()) {
      this.#stopTimer(id);
    }
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
    const tasks = scheduler.#database.query.scheduledTask.findMany().sync();
    for (const task of tasks) {
      scheduler.#startTimer(task.id, task.cron, task.once === 1);
    }
    logger.info("Scheduler started", { taskCount: tasks.length });
    return scheduler;
  }
}

// Bun.cron.parse types are not yet in @types/bun.
declare namespace Bun {
  namespace cron {
    function parse(expression: string, cursor?: Date): Date | null;
  }
}

export namespace Scheduler {
  export type TaskKind = "session" | "background";

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

  export interface Task {
    readonly id: string;
    readonly sessionId: string;
    readonly kind: TaskKind;
    readonly cron: string;
    readonly description: string;
    readonly prompt: string;
    readonly once: boolean;
    readonly nextRun: string | null;
  }
}
