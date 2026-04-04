import type { Context } from "grammy";
import type { FloatingPromises } from "~/lib/floating-promises";
import type { Scope } from "~/lib/scope";

function grammyEventLoopGetQueueId(ctx: Context): string {
  const callbackMessage =
    ctx.callbackQuery?.message && typeof ctx.callbackQuery.message === "object"
      ? ctx.callbackQuery.message
      : undefined;
  const chatId = ctx.chat?.id ?? callbackMessage?.chat.id ?? 0;
  const threadId =
    ctx.msg?.message_thread_id ?? callbackMessage?.message_thread_id ?? 0;
  return `${chatId}:${threadId}`;
}

export class GrammyEventLoop implements AsyncDisposable {
  readonly #floatingPromises: FloatingPromises;
  readonly #abortController: AbortController;
  readonly #stopped: Promise<void>;
  readonly #settled: Promise<void>;
  readonly #resolveStopped: () => void;
  readonly #rejectStopped: (reason?: unknown) => void;
  readonly #queueTails = new Map<string, Promise<void>>();
  readonly #queuedEvents = new Set<Promise<void>>();
  #closing: Promise<void> | undefined;
  #failed = false;
  #failure: unknown;

  private constructor(floatingPromises: FloatingPromises) {
    this.#floatingPromises = floatingPromises;
    this.#abortController = new AbortController();
    const { resolve, reject, promise } = Promise.withResolvers<void>();
    this.#resolveStopped = resolve;
    this.#rejectStopped = reject;
    this.#stopped = promise;
    // stopped may reject before the consumer awaits it. Without this handler,
    // the rejection would be unhandled.
    this.#settled = this.#stopped.then(
      () => {},
      () => {},
    );
  }

  #enqueue(ctx: Context, onEvent: () => void | Promise<void>) {
    if (this.#abortController.signal.aborted) return;
    const queueId = grammyEventLoopGetQueueId(ctx);
    const previous = this.#queueTails.get(queueId) ?? Promise.resolve();
    const current = previous.then(async () => {
      if (this.#abortController.signal.aborted) return;
      await onEvent();
    });
    current.catch((error) => {
      if (this.#abortController.signal.aborted) return;
      this.#fail(error);
    });
    const queued = current.finally(() => {
      this.#queuedEvents.delete(queued);
      if (this.#queueTails.get(queueId) === queued) {
        this.#queueTails.delete(queueId);
      }
    });
    this.#queueTails.set(queueId, queued);
    this.#queuedEvents.add(queued);
    this.#floatingPromises.track(queued);
  }

  async #settleQueuedEvents(): Promise<void> {
    while (this.#queuedEvents.size > 0) {
      await Promise.allSettled(this.#queuedEvents);
    }
  }

  async #finalize(): Promise<void> {
    await this.#settleQueuedEvents();
    if (this.#failed) {
      this.#rejectStopped(this.#failure);
    } else {
      this.#resolveStopped();
    }
  }

  #close() {
    if (this.#closing) return;
    this.#abortController.abort();
    this.#closing = this.#finalize();
  }

  #fail(error: unknown) {
    this.#failed = true;
    this.#failure = error;
    this.#close();
  }

  get stopped(): Promise<void> {
    return this.#stopped;
  }

  connect<C extends Context>(
    scope: Scope,
    fn: (scope: Scope, ctx: C, signal: AbortSignal) => Promise<void>,
  ): (ctx: C) => void {
    return (ctx) => {
      this.#enqueue(ctx, () => fn(scope, ctx, scope.shutdown.signal));
    };
  }

  async [Symbol.asyncDispose]() {
    this.#close();
    await this.#settled;
  }

  static create(floatingPromises: FloatingPromises): GrammyEventLoop {
    return new GrammyEventLoop(floatingPromises);
  }
}
