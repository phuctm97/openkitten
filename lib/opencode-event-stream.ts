import type { Event } from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { FloatingPromises } from "~/lib/floating-promises";
import { logger } from "~/lib/logger";

export class OpencodeEventStream implements AsyncDisposable {
  readonly #opencodeClient: OpencodeClient;
  readonly #floatingPromises: FloatingPromises;
  readonly #abortController: AbortController;
  readonly #closed: Promise<void>;
  readonly #settled: Promise<void>;
  readonly #onRestart: (signal: AbortSignal) => void | Promise<void>;
  readonly #onEvent: (
    event: Event,
    signal: AbortSignal,
  ) => void | Promise<void>;

  private constructor(
    opencodeClient: OpencodeClient,
    floatingPromises: FloatingPromises,
    onRestart: (signal: AbortSignal) => void | Promise<void>,
    onEvent: (event: Event, signal: AbortSignal) => void | Promise<void>,
  ) {
    this.#opencodeClient = opencodeClient;
    this.#abortController = new AbortController();
    this.#floatingPromises = floatingPromises;
    this.#onRestart = onRestart;
    this.#onEvent = onEvent;

    // #run() may reject before abort (max retries exhausted) and only resolves
    // after abort (signal.aborted breaks in try and catch). So closed never
    // rejects after dispose.
    this.#closed = this.#run();

    // closed rejects on max reconnect attempts but may not be awaited immediately
    // by the consumer. Without this handler, closed's rejection would be unhandled.
    // So settled always resolves regardless of closed's outcome.
    this.#settled = this.#closed.then(
      () => {},
      () => {},
    );
  }

  async #run(): Promise<void> {
    logger.debug("OpenCode event stream is connecting…");
    let attempt = 0;
    for (;;) {
      try {
        if (this.#abortController.signal.aborted) break;
        const { stream } = await this.#opencodeClient.event.subscribe(
          {},
          { signal: this.#abortController.signal, throwOnError: true },
        );
        const iter = stream[Symbol.asyncIterator]();
        const onAbort = () => {
          const returned = iter.return?.(undefined);
          if (returned) this.#floatingPromises.track(returned);
        };
        try {
          this.#abortController.signal.addEventListener("abort", onAbort, {
            once: true,
          });
          // onRestart/onEvent errors are treated as stream failures and will trigger reconnections.
          logger.info("OpenCode event stream is connected");
          await this.#onRestart(this.#abortController.signal);
          for (;;) {
            const result = await iter.next();
            if (result.done)
              throw new Error("OpenCode event stream ended unexpectedly");
            await this.#onEvent(result.value, this.#abortController.signal);
            // Reset after first successful event — the connection is genuinely
            // working, so future failures should start backoff from scratch.
            attempt = 0;
          }
        } finally {
          this.#abortController.signal.removeEventListener("abort", onAbort);
          // Ensure iterator cleanup even on stream errors, not just aborts.
          onAbort();
        }
      } catch (error) {
        if (this.#abortController.signal.aborted) break;
        if (attempt >= OpencodeEventStream.maxAttempt) throw error;
        const delay = Math.min(
          1000 * 2 ** attempt,
          OpencodeEventStream.maxDelay,
        );
        logger.warn(
          "OpenCode event stream is disconnected, reconnecting…",
          error,
          {
            attempt,
            delay,
          },
        );
        attempt++;
        const { resolve, promise: aborted } = Promise.withResolvers<void>();
        const onAbort = () => resolve();
        try {
          this.#abortController.signal.addEventListener("abort", onAbort, {
            once: true,
          });
          await Promise.race([Bun.sleep(delay), aborted]);
        } finally {
          this.#abortController.signal.removeEventListener("abort", onAbort);
          // Resolve the aborted promise so it can be GC'd (abort may never fire).
          onAbort();
        }
      }
    }
    logger.info("OpenCode event stream is closed");
  }

  get closed(): Promise<void> {
    return this.#closed;
  }

  async [Symbol.asyncDispose]() {
    this.#abortController.abort();
    await this.#settled;
  }

  static readonly maxAttempt = 10;
  static readonly maxDelay = 30_000;

  static create(
    opencodeClient: OpencodeClient,
    floatingPromises: FloatingPromises,
    onRestart: (signal: AbortSignal) => void | Promise<void>,
    onEvent: (event: Event, signal: AbortSignal) => void | Promise<void>,
  ): OpencodeEventStream {
    return new OpencodeEventStream(
      opencodeClient,
      floatingPromises,
      onRestart,
      onEvent,
    );
  }
}
