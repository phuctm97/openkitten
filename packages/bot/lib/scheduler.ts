import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { Bunqueue } from "bunqueue/client";
import type { Bot } from "grammy";
import type { Database } from "~/lib/database";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { logger } from "~/lib/logger";

interface ScheduleJobData {
  readonly type: "message" | "prompt";
  readonly chatId: number;
  readonly threadId: number | undefined;
  readonly description: string;
  readonly prompt: string;
  readonly cron: string;
  readonly once: boolean;
}

export class Scheduler implements Disposable {
  readonly #queue: Bunqueue<ScheduleJobData, void>;
  readonly #bot: Bot;
  readonly #database: Database;
  readonly #opencodeClient: OpencodeClient;
  readonly #existingSessions: ExistingSessions;

  private constructor(
    queue: Bunqueue<ScheduleJobData, void>,
    bot: Bot,
    database: Database,
    opencodeClient: OpencodeClient,
    existingSessions: ExistingSessions,
  ) {
    this.#queue = queue;
    this.#bot = bot;
    this.#database = database;
    this.#opencodeClient = opencodeClient;
    this.#existingSessions = existingSessions;
  }

  async create(input: Scheduler.CreateInput): Promise<Scheduler.Task> {
    const jobData: ScheduleJobData = {
      type: input.type,
      chatId: input.chatId,
      threadId: input.threadId,
      description: input.description,
      prompt: input.prompt,
      cron: input.cron,
      once: input.once,
    };
    if (input.once) {
      const delay = this.#computeDelay(input.cron);
      const job = await this.#queue.add(input.description, jobData, { delay });
      return {
        id: job.id,
        type: input.type,
        cron: input.cron,
        description: input.description,
        prompt: input.prompt,
        paused: false,
        once: true,
        nextRun: this.#nextRun(input.cron),
      };
    }
    const info = await this.#queue.cron(input.description, input.cron, jobData);
    return {
      id: info ? String(info.id) : crypto.randomUUID(),
      type: input.type,
      cron: input.cron,
      description: input.description,
      prompt: input.prompt,
      paused: false,
      once: false,
      nextRun: this.#nextRun(input.cron),
    };
  }

  async list(): Promise<Scheduler.Task[]> {
    const crons = await this.#queue.listCrons();
    return crons.map((info) => ({
      id: String(info.id),
      type: "prompt" as const,
      cron: info.pattern ?? "",
      description: info.name,
      prompt: "",
      paused: false,
      once: false,
      nextRun: info.next ? new Date(info.next).toISOString() : null,
    }));
  }

  async delete(id: string): Promise<void> {
    const removed = await this.#queue.removeCron(id);
    if (!removed) {
      await this.#queue.queue.removeAsync(id);
    }
  }

  async trigger(id: string): Promise<void> {
    const job = await this.#queue.getJob(id);
    if (!job) throw new Scheduler.NotFoundError(id);
    await this.#execute(job.data);
  }

  #computeDelay(cron: string): number {
    try {
      const next = Bun.cron.parse(cron);
      if (!next) return 0;
      return Math.max(next.getTime() - Date.now(), 0);
    } catch {
      return 0;
    }
  }

  #nextRun(cron: string): string | null {
    try {
      const next = Bun.cron.parse(cron);
      return next ? next.toISOString() : null;
    } catch {
      return null;
    }
  }

  async #execute(data: ScheduleJobData): Promise<void> {
    if (data.type === "message") {
      await this.#bot.api.sendMessage(data.chatId, data.prompt, {
        ...(data.threadId && { message_thread_id: data.threadId }),
      });
      return;
    }
    const sessionId = await this.#existingSessions.find(
      { chatId: data.chatId, threadId: data.threadId },
      { createIfNotFound: true },
    );
    const agent = getSessionAgent(this.#database, sessionId);
    await this.#opencodeClient.session.promptAsync(
      {
        sessionID: sessionId,
        ...(agent && { agent }),
        parts: [{ type: "text", text: `[Scheduled Task] ${data.prompt}` }],
      },
      { throwOnError: true },
    );
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
    dataDir: string,
  ): Scheduler {
    mkdirSync(join(dataDir, "openkitten"), { recursive: true });
    const queue = new Bunqueue<ScheduleJobData, void>("openkitten-scheduler", {
      embedded: true,
      dataPath: join(dataDir, "openkitten", "scheduler.db"),
      processor: async (job) => {
        const instance = Scheduler.#instance;
        if (!instance) {
          logger.warn("Scheduler not ready, skipping job");
          return;
        }
        try {
          await instance.#execute(job.data);
        } catch (error) {
          logger.error("Scheduled task failed", error);
          throw error;
        }
      },
    });
    const scheduler = new Scheduler(
      queue,
      bot,
      database,
      opencodeClient,
      existingSessions,
    );
    Scheduler.#instance = scheduler;
    return scheduler;
  }

  static #instance: Scheduler | undefined;
}

// Bun.cron.parse types are not yet in @types/bun.
declare namespace Bun {
  namespace cron {
    function parse(expression: string, cursor?: Date): Date | null;
  }
}

export namespace Scheduler {
  export type TaskType = "message" | "prompt";

  export interface CreateInput {
    readonly type: TaskType;
    readonly chatId: number;
    readonly threadId: number | undefined;
    readonly cron: string;
    readonly description: string;
    readonly prompt: string;
    readonly once: boolean;
  }

  export interface Task {
    readonly id: string;
    readonly type: TaskType;
    readonly cron: string;
    readonly description: string;
    readonly prompt: string;
    readonly paused: boolean;
    readonly once: boolean;
    readonly nextRun: string | null;
  }
}
