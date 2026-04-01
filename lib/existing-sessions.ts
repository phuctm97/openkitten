import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { and, eq } from "drizzle-orm";
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
  readonly #removing = new Set<string>();

  private constructor(
    bot: Bot,
    database: Database,
    opencodeClient: OpencodeClient,
  ) {
    this.#bot = bot;
    this.#database = database;
    this.#opencodeClient = opencodeClient;
  }

  #find(location: ExistingSessions.Location): string | undefined {
    const row = this.#database.query.session
      .findFirst({
        columns: { id: true },
        where: and(
          eq(schema.session.chatId, location.chatId),
          eq(schema.session.threadId, location.threadId || 0),
        ),
      })
      .sync();
    return row?.id;
  }

  async #create(location: ExistingSessions.Location): Promise<string> {
    const {
      data: { id: sessionId },
    } = await this.#opencodeClient.session.create({}, { throwOnError: true });

    const normalized: ExistingSessions.Location = {
      chatId: location.chatId,
      threadId: location.threadId || undefined,
    };

    try {
      this.#database
        .insert(schema.session)
        .values({
          id: sessionId,
          chatId: normalized.chatId,
          threadId: normalized.threadId || 0,
        })
        .run();
      logger.info("New session is created", { sessionId, ...normalized });
      return sessionId;
    } catch (error) {
      // Race condition: another concurrent call created the session first.
      // Clean up the orphaned opencode session.
      await this.#opencodeClient.session.delete(
        { sessionID: sessionId },
        { throwOnError: true },
      );
      // Return the raced winner from DB.
      const raced = this.#find(location);
      // No winner in DB — insert failed for a reason other than a race condition.
      if (!raced) throw error;
      return raced;
    }
  }

  get sessionIds(): readonly string[] {
    return this.#database.query.session
      .findMany({ columns: { id: true } })
      .sync()
      .map((row) => row.id);
  }

  readonly hook: Hookable<ExistingSessions.Hooks>["hook"] = (...args) =>
    this.#hooks.hook(...args);

  check(sessionId: string): boolean {
    return !!this.#database.query.session
      .findFirst({
        columns: { id: true },
        where: eq(schema.session.id, sessionId),
      })
      .sync();
  }

  get(
    sessionId: string,
    options: ExistingSessions.GetOrThrowOptions,
  ): ExistingSessions.Location;
  get(
    sessionId: string,
    options?: ExistingSessions.GetOptions,
  ): ExistingSessions.Location | undefined;
  get(
    sessionId: string,
    options: ExistingSessions.GetOptions = {},
  ): ExistingSessions.Location | undefined {
    const row = this.#database.query.session
      .findFirst({
        columns: { chatId: true, threadId: true },
        where: eq(schema.session.id, sessionId),
      })
      .sync();
    if (!row) {
      if (options.throwIfNotFound) {
        throw new ExistingSessions.NotFoundError(sessionId);
      }
      return undefined;
    }
    return {
      chatId: row.chatId,
      threadId: row.threadId || undefined,
    };
  }

  find(
    location: ExistingSessions.Location,
    options: ExistingSessions.FindOrCreateOptions,
  ): Promise<string>;
  find(
    location: ExistingSessions.Location,
    options?: ExistingSessions.FindOptions,
  ): string | undefined;
  find(
    location: ExistingSessions.Location,
    options: ExistingSessions.FindOptions = {},
  ): string | undefined | Promise<string> {
    const existing = this.#find(location);
    if (existing) {
      if (options.createIfNotFound) return Promise.resolve(existing);
      return existing;
    }
    if (!options.createIfNotFound) return undefined;
    return this.#create(location);
  }

  async remove(sessionId: string): Promise<void> {
    const row = this.#database.query.session
      .findFirst({
        columns: { chatId: true, threadId: true },
        where: eq(schema.session.id, sessionId),
      })
      .sync();
    if (!row || this.#removing.has(sessionId)) return;
    const location: ExistingSessions.Location = {
      chatId: row.chatId,
      threadId: row.threadId || undefined,
    };
    try {
      this.#removing.add(sessionId);
      const abortResults = await Promise.allSettled([
        this.#opencodeClient.session.abort(
          { sessionID: sessionId },
          { throwOnError: true },
        ),
      ]);
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
      Errors.throwIfAny<unknown>([
        ...abortResults,
        ...hookResults,
        databaseResult,
      ]);
    } finally {
      this.#removing.delete(sessionId);
      logger.info("Existing session is removed", { sessionId });
    }
  }

  async #initialize(): Promise<void> {
    const currentSessions = this.#database.query.session
      .findMany({
        columns: { id: true, chatId: true, threadId: true },
      })
      .sync()
      .map((row) => ({
        id: row.id,
        chatId: row.chatId,
        threadId: row.threadId || undefined,
      }));

    // Check reachability for all current sessions
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

    logger.debug("Current sessions are synchronized", {
      checked: currentSessions.length,
      removed: unreachableSessions.length,
      remaining: currentSessions.length - unreachableSessions.length,
    });
  }

  static readonly NotFoundError = class NotFoundError extends Error {
    readonly sessionId: string;

    constructor(sessionId: string) {
      super(`No session found: ${sessionId}`);
      this.sessionId = sessionId;
    }
  };

  static async create(
    bot: Bot,
    database: Database,
    opencodeClient: OpencodeClient,
  ): Promise<ExistingSessions> {
    const existingSessions = new ExistingSessions(
      bot,
      database,
      opencodeClient,
    );
    await existingSessions.#initialize();
    return existingSessions;
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

  export interface GetOptions {
    readonly throwIfNotFound?: boolean;
  }

  export interface GetOrThrowOptions extends GetOptions {
    readonly throwIfNotFound: true;
  }

  export interface FindOptions {
    readonly createIfNotFound?: boolean;
  }

  export interface FindOrCreateOptions extends FindOptions {
    readonly createIfNotFound: true;
  }
}
