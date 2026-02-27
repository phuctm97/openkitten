import type { Bot } from "grammy";
import { Errors } from "~/lib/errors";
import type { ExistingSessions } from "~/lib/existing-sessions";
import type { FloatingPromises } from "~/lib/floating-promises";
import { logger } from "~/lib/logger";
import type { PendingPrompts } from "~/lib/pending-prompts";
import type { Shutdown } from "~/lib/shutdown";
import type { WorkingSessions } from "~/lib/working-sessions";

export class TypingIndicators implements Disposable {
  readonly #shutdown: Shutdown;
  readonly #bot: Bot;
  readonly #existingSessions: ExistingSessions;
  readonly #workingSessions: WorkingSessions;
  readonly #pendingPrompts: PendingPrompts;
  readonly #floatingPromises: FloatingPromises;
  readonly #timers = new Map<string, Timer | undefined>();
  readonly #unhooks: (() => void)[];

  private constructor(
    shutdown: Shutdown,
    bot: Bot,
    existingSessions: ExistingSessions,
    workingSessions: WorkingSessions,
    pendingPrompts: PendingPrompts,
    floatingPromises: FloatingPromises,
  ) {
    this.#shutdown = shutdown;
    this.#bot = bot;
    this.#existingSessions = existingSessions;
    this.#workingSessions = workingSessions;
    this.#pendingPrompts = pendingPrompts;
    this.#floatingPromises = floatingPromises;
    this.#unhooks = [
      existingSessions.hook("beforeRemove", ({ sessionId }) => {
        this.#stop(sessionId);
      }),
      workingSessions.hook("change", async ({ sessionId }) => {
        await this.#sync(sessionId);
      }),
      pendingPrompts.hook("change", async ({ sessionId }) => {
        await this.#sync(sessionId);
      }),
    ];
  }

  #typing(sessionId: string): boolean {
    return (
      this.#workingSessions.check(sessionId) &&
      !this.#pendingPrompts.check(sessionId)
    );
  }

  #send(sessionId: string) {
    const { chatId, threadId } = this.#existingSessions.resolve(sessionId);
    return this.#bot.api.sendChatAction(chatId, "typing", {
      ...(threadId && { message_thread_id: threadId }),
    });
  }

  async #sync(sessionId: string) {
    if (this.#typing(sessionId)) {
      await this.#start(sessionId);
    } else {
      this.#stop(sessionId);
    }
  }

  async #start(sessionId: string) {
    if (this.#timers.has(sessionId)) return;
    // Reserve the slot before the async send so concurrent calls bail out above.
    // After send, re-check: #stop may have cleared the slot while we were awaiting.
    this.#timers.set(sessionId, undefined);
    await this.#send(sessionId);
    if (!this.#timers.has(sessionId)) return;
    this.#timers.set(
      sessionId,
      setInterval(() => {
        this.#floatingPromises.track(
          this.#send(sessionId).catch((error) => {
            logger.fatal("Failed to send typing indicator to Telegram", error, {
              sessionId,
            });
            this.#shutdown.trigger();
          }),
        );
      }, 4_000),
    );
  }

  #stop(sessionId: string) {
    const timer = this.#timers.get(sessionId);
    if (timer) clearInterval(timer);
    this.#timers.delete(sessionId);
  }

  check(sessionId: string): boolean {
    return this.#timers.has(sessionId);
  }

  async invalidate() {
    const { sessionIds } = this.#existingSessions;
    if (sessionIds.length === 0) return;
    const promises: Promise<void>[] = [];
    for (const sessionId of sessionIds) {
      if (this.#typing(sessionId)) {
        promises.push(this.#start(sessionId));
      } else {
        this.#stop(sessionId);
      }
    }
    const results = await Promise.allSettled(promises);
    Errors.throwIfAny(results);
  }

  [Symbol.dispose]() {
    for (const unhook of this.#unhooks) unhook();
    for (const sessionId of this.#timers.keys()) this.#stop(sessionId);
  }

  static create(
    shutdown: Shutdown,
    bot: Bot,
    existingSessions: ExistingSessions,
    workingSessions: WorkingSessions,
    pendingPrompts: PendingPrompts,
    floatingPromises: FloatingPromises,
  ): TypingIndicators {
    return new TypingIndicators(
      shutdown,
      bot,
      existingSessions,
      workingSessions,
      pendingPrompts,
      floatingPromises,
    );
  }
}
