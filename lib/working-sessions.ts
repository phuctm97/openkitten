import type { EventSessionStatus, SessionStatus } from "@opencode-ai/sdk/v2";
import type { Bot } from "grammy";
import { createHooks, type Hookable } from "hookable";
import { Errors } from "~/lib/errors";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammySendBusy } from "~/lib/grammy-send-busy";

export class WorkingSessions implements Disposable {
  readonly #bot: Bot;
  readonly #existingSessions: ExistingSessions;
  readonly #hooks = createHooks<WorkingSessions.Hooks>();
  readonly #cached = new Set<string>();
  readonly #locked = new Set<string>();
  readonly #unhook: () => void;

  private constructor(bot: Bot, existingSessions: ExistingSessions) {
    this.#bot = bot;
    this.#existingSessions = existingSessions;
    this.#unhook = existingSessions.hook(
      "beforeRemove",
      async ({ sessionId }) => {
        await this.#release(sessionId);
      },
    );
  }

  async #release(sessionId: string) {
    if (!this.#cached.has(sessionId)) return;
    this.#cached.delete(sessionId);
    const results = await this.#hooks.callHookWith(
      (hooks, args) => Promise.allSettled(hooks.map((hook) => hook(...args))),
      "change",
      [{ sessionId, working: false }],
    );
    Errors.throwIfAny(results);
  }

  readonly hook: Hookable<WorkingSessions.Hooks>["hook"] = (...args) =>
    this.#hooks.hook(...args);

  check(sessionId: string): boolean {
    return this.#cached.has(sessionId);
  }

  // Reject if the session is already working (server busy) or another
  // message is being processed (locked locally).
  async lock(
    sessionId: string,
    fn: (sessionId: string) => Promise<void>,
  ): Promise<void> {
    if (this.#cached.has(sessionId) || this.#locked.has(sessionId)) {
      const { chatId, threadId } = this.#existingSessions.resolve(sessionId);
      await grammySendBusy({
        bot: this.#bot,
        chatId,
        threadId,
      });
      return;
    }
    try {
      this.#locked.add(sessionId);
      await fn(sessionId);
    } finally {
      this.#locked.delete(sessionId);
    }
  }

  async update(event: EventSessionStatus) {
    const { sessionID, status } = event.properties;
    const working = status.type === "busy" || status.type === "retry";
    if (working) {
      if (this.#cached.has(sessionID)) return;
      this.#cached.add(sessionID);
    } else {
      if (!this.#cached.has(sessionID)) return;
      this.#cached.delete(sessionID);
    }
    const results = await this.#hooks.callHookWith(
      (hooks, args) => Promise.allSettled(hooks.map((hook) => hook(...args))),
      "change",
      [{ sessionId: sessionID, working }],
    );
    Errors.throwIfAny(results);
  }

  async invalidate(statuses: { readonly [sessionId: string]: SessionStatus }) {
    const promises = [];
    for (const sessionId of this.#existingSessions.sessionIds) {
      const status = statuses[sessionId];
      const working = status?.type === "busy" || status?.type === "retry";
      if (working) {
        if (this.#cached.has(sessionId)) continue;
        this.#cached.add(sessionId);
      } else {
        if (!this.#cached.has(sessionId)) continue;
        this.#cached.delete(sessionId);
      }
      promises.push(
        this.#hooks.callHookWith(
          (hooks, args) =>
            Promise.allSettled(hooks.map((hook) => hook(...args))),
          "change",
          [{ sessionId, working }],
        ),
      );
    }
    const results = (await Promise.all(promises)).flat();
    Errors.throwIfAny(results);
  }

  [Symbol.dispose]() {
    this.#unhook();
  }

  static create(bot: Bot, existingSessions: ExistingSessions): WorkingSessions {
    return new WorkingSessions(bot, existingSessions);
  }
}

export namespace WorkingSessions {
  export interface ChangeEvent {
    readonly sessionId: string;
    readonly working: boolean;
  }

  export interface Hooks {
    change: (event: ChangeEvent) => Promise<void> | void;
  }
}
