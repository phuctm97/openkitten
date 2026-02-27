import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import { createHooks, type Hookable } from "hookable";
import type { Database } from "~/lib/database";
import { Errors } from "~/lib/errors";
import { grammyCheckGoneError } from "~/lib/grammy-check-gone-error";
import { logger } from "~/lib/logger";
import * as schema from "~/lib/schema";

export class ExistingSessions {
  readonly #bot: Bot;
  readonly #database: Database;
  readonly #opencodeClient: OpencodeClient;
  readonly #hooks = createHooks<ExistingSessions.Hooks>();
  readonly #sessionMap = new Map<string, ExistingSessions.Location>();
  readonly #locationMap = new Map<string, string>();
  readonly #removing = new Set<string>();
  #initialized = false;

  private constructor(
    bot: Bot,
    database: Database,
    opencodeClient: OpencodeClient,
  ) {
    this.#bot = bot;
    this.#database = database;
    this.#opencodeClient = opencodeClient;
  }

  #locationKey({ chatId, threadId }: ExistingSessions.Location): string {
    return `${chatId}:${threadId || ""}`;
  }

  get sessionIds(): readonly string[] {
    return [...this.#sessionMap.keys()];
  }

  readonly hook: Hookable<ExistingSessions.Hooks>["hook"] = (...args) =>
    this.#hooks.hook(...args);

  check(sessionId: string): boolean {
    return this.#sessionMap.has(sessionId);
  }

  resolve(sessionId: string): ExistingSessions.Location {
    const location = this.#sessionMap.get(sessionId);
    if (!location) throw new ExistingSessions.NotFoundError(sessionId);
    return location;
  }

  async remove(sessionId: string): Promise<void> {
    const location = this.#sessionMap.get(sessionId);
    if (!location || this.#removing.has(sessionId)) return;
    try {
      this.#removing.add(sessionId);
      const hookResults = await this.#hooks.callHookWith(
        (hooks, args) => Promise.allSettled(hooks.map((hook) => hook(...args))),
        "beforeRemove",
        [{ sessionId, ...location }],
      );
      let databaseResult: PromiseSettledResult<void>;
      try {
        this.#database
          .delete(schema.session)
          .where(eq(schema.session.id, sessionId))
          .run();
        databaseResult = { status: "fulfilled", value: undefined };
      } catch (error) {
        databaseResult = { status: "rejected", reason: error };
      }
      Errors.throwIfAny([...hookResults, databaseResult]);
    } finally {
      // Always evict from maps: once removal starts, the session is gone
      // regardless of hook/DB errors.
      this.#removing.delete(sessionId);
      this.#sessionMap.delete(sessionId);
      this.#locationMap.delete(this.#locationKey(location));
      logger.info("Existing session is removed", { sessionId });
    }
  }

  async findOrCreate(
    chatId: number,
    threadId: number | undefined,
  ): Promise<string> {
    const threadKey = threadId || undefined;

    const locationObject: ExistingSessions.Location = {
      chatId,
      threadId: threadKey,
    };
    const locationKey = this.#locationKey(locationObject);

    const existing = this.#locationMap.get(locationKey);
    if (existing) return existing;

    const {
      data: { id: sessionId },
    } = await this.#opencodeClient.session.create({}, { throwOnError: true });

    try {
      this.#database
        .insert(schema.session)
        .values({ id: sessionId, chatId, threadId: threadKey || 0 })
        .run();
      this.#sessionMap.set(sessionId, locationObject);
      this.#locationMap.set(locationKey, sessionId);
      logger.info("New session is created", {
        sessionId,
        ...locationObject,
      });
      return sessionId;
    } catch (error) {
      // Race condition: another concurrent call created the session first.
      // Clean up the orphaned opencode session.
      await this.#opencodeClient.session.delete(
        { sessionID: sessionId },
        { throwOnError: true },
      );
      // Return the raced winner from maps.
      const raced = this.#locationMap.get(locationKey);
      // No winner in maps — insert failed for a reason other than a race condition.
      if (!raced) throw error;
      return raced;
    }
  }

  async invalidate(): Promise<void> {
    // Load persisted sessions from DB on first run
    if (!this.#initialized) {
      const rows = this.#database.query.session
        .findMany({
          columns: { id: true, chatId: true, threadId: true },
        })
        .sync();
      for (const row of rows) {
        if (this.#sessionMap.has(row.id)) continue;
        const location: ExistingSessions.Location = {
          chatId: row.chatId,
          threadId: row.threadId || undefined,
        };
        this.#sessionMap.set(row.id, location);
        this.#locationMap.set(this.#locationKey(location), row.id);
      }
      this.#initialized = true;
    }

    // Check reachability for all current sessions
    const currentSessions = [...this.#sessionMap.entries()].map(
      ([id, location]) => ({
        id,
        ...location,
      }),
    );
    const reachabilityResults = await Promise.allSettled(
      currentSessions.map(async (session) => {
        try {
          await this.#bot.api.sendChatAction(session.chatId, "typing", {
            ...(session.threadId && { message_thread_id: session.threadId }),
          });
          return true;
        } catch (error) {
          if (grammyCheckGoneError(error)) return false;
          throw error;
        }
      }),
    );
    Errors.throwIfAny(reachabilityResults);

    // Remove unreachable sessions via remove() to ensure proper cleanup
    const unreachableSessions = currentSessions.filter(
      (_, i) => !reachabilityResults[i]?.value,
    );
    const removalResults = await Promise.allSettled(
      unreachableSessions.map((s) => this.remove(s.id)),
    );
    Errors.throwIfAny(removalResults);

    logger.debug("Current sessions are invalidated", {
      checked: currentSessions.length,
      removed: unreachableSessions.length,
      remaining: this.#sessionMap.size,
    });
  }

  static readonly NotFoundError = class NotFoundError extends Error {
    readonly sessionId: string;

    constructor(sessionId: string) {
      super(`No session found: ${sessionId}`);
      this.sessionId = sessionId;
    }
  };

  static create(
    bot: Bot,
    database: Database,
    opencodeClient: OpencodeClient,
  ): ExistingSessions {
    return new ExistingSessions(bot, database, opencodeClient);
  }
}

export namespace ExistingSessions {
  export interface Location {
    readonly chatId: number;
    readonly threadId: number | undefined;
  }

  export interface BeforeRemoveEvent extends Location {
    readonly sessionId: string;
  }

  export interface Hooks {
    beforeRemove: (event: BeforeRemoveEvent) => Promise<void> | void;
  }
}
