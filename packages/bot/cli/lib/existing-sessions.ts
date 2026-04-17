import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { and, eq } from "drizzle-orm";
import type { Bot } from "grammy";
import { createHooks, type Hookable } from "hookable";
import type { Database } from "~/lib/database";
import { Errors } from "~/lib/errors";
import { grammyCheckGoneError } from "~/lib/grammy-check-gone-error";
import * as schema from "~/lib/schema";

export class ExistingSessions {
  readonly #bot: Bot;
  readonly #database: Database;
  readonly #opencodeClient: OpencodeClient;
  readonly #hooks = createHooks<ExistingSessions.Hooks>();
  readonly #removingPromises = new Map<string, Promise<void>>();

  private constructor(
    bot: Bot,
    database: Database,
    opencodeClient: OpencodeClient,
  ) {
    this.#bot = bot;
    this.#database = database;
    this.#opencodeClient = opencodeClient;
  }

  #findOrReturn(location: ExistingSessions.Location): string | undefined {
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

  async #findOrCreate(location: ExistingSessions.Location): Promise<string> {
    for (;;) {
      const existing = this.#findOrReturn(location);
      if (existing) {
        const removing = this.#removingPromises.get(existing);
        if (!removing) return existing;
        await removing;
        continue;
      }
      const created = await this.#create(location);
      const removing = this.#removingPromises.get(created);
      if (!removing) return created;
      await removing;
    }
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
      return sessionId;
    } catch (error) {
      // Race condition: another concurrent call created the session first.
      // Clean up the orphaned opencode session.
      await this.#opencodeClient.session.delete(
        { sessionID: sessionId },
        { throwOnError: true },
      );
      // Return the raced winner from DB.
      const raced = this.#findOrReturn(location);
      // No winner in DB — insert failed for a reason other than a race condition.
      if (!raced) throw error;
      return raced;
    }
  }

  async #remove(
    sessionId: string,
    location: ExistingSessions.Location,
  ): Promise<void> {
    try {
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
      this.#removingPromises.delete(sessionId);
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
    return (
      !this.#removingPromises.has(sessionId) &&
      !!this.#database.query.session
        .findFirst({
          columns: { id: true },
          where: eq(schema.session.id, sessionId),
        })
        .sync()
    );
  }

  get(
    sessionId: string,
    options: ExistingSessions.UnsafeGetOptions,
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
      if (options.unsafe) {
        throw new ExistingSessions.NotFoundError(sessionId);
      }
      return undefined;
    }
    if (this.#removingPromises.has(sessionId) && !options.unsafe) {
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
    const existing = this.#findOrReturn(location);
    if (existing && !this.#removingPromises.has(existing)) {
      return options.createIfNotFound ? Promise.resolve(existing) : existing;
    }
    return options.createIfNotFound ? this.#findOrCreate(location) : undefined;
  }

  async remove(sessionId: string): Promise<void> {
    const current = this.#removingPromises.get(sessionId);
    if (current) return current;
    const row = this.#database.query.session
      .findFirst({
        columns: { chatId: true, threadId: true },
        where: eq(schema.session.id, sessionId),
      })
      .sync();
    if (!row) return;
    const location: ExistingSessions.Location = {
      chatId: row.chatId,
      threadId: row.threadId || undefined,
    };
    const removal = this.#remove(sessionId, location);
    this.#removingPromises.set(sessionId, removal);
    return removal;
  }

  static readonly NotFoundError = class NotFoundError extends Error {
    readonly sessionId: string;

    constructor(sessionId: string) {
      super(`Session not found: ${sessionId}`);
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
    readonly unsafe?: boolean;
  }

  export interface UnsafeGetOptions extends GetOptions {
    readonly unsafe: true;
  }

  export interface FindOptions {
    readonly createIfNotFound?: boolean;
  }

  export interface FindOrCreateOptions extends FindOptions {
    readonly createIfNotFound: true;
  }
}
