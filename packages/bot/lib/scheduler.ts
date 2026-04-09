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

interface TaskData {
  readonly taskId: string;
  readonly sessionId: string;
  readonly kind: Scheduler.TaskKind;
  readonly cron: string;
  readonly description: string;
  readonly prompt: string;
  readonly once: boolean;
}

export class Scheduler implements Disposable {
  readonly #bot: Bot;
  readonly #database: Database;
  readonly #opencodeClient: OpencodeClient;
  readonly #existingSessions: ExistingSessions;
  readonly #queue: Bunqueue<TaskData>;
  readonly #tasks = new Map<string, TaskData>();

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
    if (input.once) {
      await this.#queue.queue.upsertJobScheduler(
        id,
        { pattern: input.cron, limit: 1 },
        { name: id, data: taskData },
      );
    } else {
      await this.#queue.cron(id, input.cron, taskData);
    }
    this.#tasks.set(id, taskData);
    return this.#toTask(taskData);
  }

  list(): Scheduler.Task[] {
    return [...this.#tasks.values()].map((data) => this.#toTask(data));
  }

  get(id: string): Scheduler.Task {
    const data = this.#tasks.get(id);
    if (!data) throw new Scheduler.NotFoundError(id);
    return this.#toTask(data);
  }

  async delete(id: string): Promise<void> {
    if (!this.#tasks.has(id)) throw new Scheduler.NotFoundError(id);
    await this.#queue.removeCron(id);
    this.#tasks.delete(id);
  }

  async trigger(id: string): Promise<void> {
    const data = this.#tasks.get(id);
    if (!data) throw new Scheduler.NotFoundError(id);
    await this.#queue.queue.add(`trigger-${data.taskId}`, data);
  }

  async update(
    id: string,
    input: Scheduler.UpdateInput,
  ): Promise<Scheduler.Task> {
    const existing = this.#tasks.get(id);
    if (!existing) throw new Scheduler.NotFoundError(id);
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
    if (cronChanged) {
      await this.#queue.removeCron(id);
      try {
        if (existing.once) {
          await this.#queue.queue.upsertJobScheduler(
            id,
            { pattern: cron, limit: 1 },
            { name: id, data: updated },
          );
        } else {
          await this.#queue.cron(id, cron, updated);
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
      await this.#queue.cron(id, cron, updated);
    }
    this.#tasks.set(id, updated);
    return this.#toTask(updated);
  }

  #toTask(data: TaskData): Scheduler.Task {
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
      nextRun: this.#nextRun(data.cron),
    };
  }

  #nextRun(cron: string): string | null {
    try {
      const next = Bun.cron.parse(cron);
      return next ? next.toISOString() : null;
    } catch {
      return null;
    }
  }

  async #processJob(job: Job<TaskData>): Promise<void> {
    const existing = this.#tasks.get(job.data.taskId);
    const data = existing ?? job.data;
    if (!existing) {
      this.#tasks.set(data.taskId, data);
    }
    try {
      await this.#execute(data);
    } finally {
      const isManualTrigger = job.name.startsWith("trigger-");
      if (data.once && !isManualTrigger) {
        this.#tasks.delete(data.taskId);
      }
    }
  }

  async #execute(data: TaskData): Promise<void> {
    if (data.kind === "background") {
      await this.#executeBackground(data);
      return;
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
  }

  async #executeBackground(data: TaskData): Promise<void> {
    const location = this.#existingSessions.get(data.sessionId);
    if (!location) {
      logger.warn("Background task session not found, skipping", {
        taskId: data.taskId,
        sessionId: data.sessionId,
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
              text: `${backgroundPromptPrefix}${data.prompt}`,
            },
          ],
        },
        { throwOnError: true },
      );
      const text = await this.#waitForText(ephemeralId, data.taskId);
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
