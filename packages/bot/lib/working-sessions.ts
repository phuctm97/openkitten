import type { EventSessionStatus } from "@opencode-ai/sdk/v2";
import { createHooks, type Hookable } from "hookable";
import { Errors } from "~/lib/errors";
import type { ExistingSessions } from "~/lib/existing-sessions";

export class WorkingSessions implements Disposable {
  readonly #existingSessions: ExistingSessions;
  readonly #hooks = createHooks<WorkingSessions.Hooks>();
  readonly #cached = new Set<string>();
  readonly #locked = new Set<string>();
  readonly #unhook: () => void;

  private constructor(existingSessions: ExistingSessions) {
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
      throw new WorkingSessions.LockedError(sessionId);
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
    const previous = this.#cached.has(sessionID);
    const next =
      this.#existingSessions.checkAvailable(sessionID) &&
      (status.type === "busy" || status.type === "retry");
    if (previous === next) return;
    if (next) this.#cached.add(sessionID);
    else this.#cached.delete(sessionID);
    const results = await this.#hooks.callHookWith(
      (hooks, args) => Promise.allSettled(hooks.map((hook) => hook(...args))),
      "change",
      [{ sessionId: sessionID, working: next }],
    );
    Errors.throwIfAny(results);
  }

  [Symbol.dispose]() {
    this.#unhook();
  }

  static readonly LockedError = class LockedError extends Error {
    readonly sessionId: string;
    constructor(sessionId: string) {
      super(`Locked session: ${sessionId}`);
      this.sessionId = sessionId;
    }
  };

  static create(existingSessions: ExistingSessions): WorkingSessions {
    return new WorkingSessions(existingSessions);
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
