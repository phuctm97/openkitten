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
  readonly #onEvent: (
    event: Event,
    signal: AbortSignal,
  ) => void | Promise<void>;

  private constructor(
    opencodeClient: OpencodeClient,
    floatingPromises: FloatingPromises,
    onEvent: (event: Event, signal: AbortSignal) => void | Promise<void>,
  ) {
    this.#opencodeClient = opencodeClient;
    this.#abortController = new AbortController();
    this.#floatingPromises = floatingPromises;
    this.#onEvent = onEvent;

    this.#closed = this.#run();

    // closed may reject before the consumer awaits it. Without this handler,
    // the rejection would be unhandled.
    this.#settled = this.#closed.then(
      () => {},
      () => {},
    );
  }

  async #run(): Promise<void> {
    logger.debug("OpenCode event stream is connecting…");
    try {
      const { stream } = await this.#opencodeClient.event.subscribe(
        {},
        { signal: this.#abortController.signal, throwOnError: true },
      );
      if (this.#abortController.signal.aborted) return;
      const iter = stream[Symbol.asyncIterator]();
      const onAbort = () => {
        const returned = iter.return?.(undefined);
        if (returned) this.#floatingPromises.track(returned);
      };
      try {
        this.#abortController.signal.addEventListener("abort", onAbort, {
          once: true,
        });
        logger.info("OpenCode event stream is connected");
        for (;;) {
          const result = await iter.next();
          if (result.done)
            throw new Error("OpenCode event stream ended unexpectedly");
          await this.#onEvent(result.value, this.#abortController.signal);
        }
      } finally {
        this.#abortController.signal.removeEventListener("abort", onAbort);
        onAbort();
      }
    } catch (error) {
      if (this.#abortController.signal.aborted) return;
      throw error;
    } finally {
      logger.info("OpenCode event stream is closed");
    }
  }

  get closed(): Promise<void> {
    return this.#closed;
  }

  async [Symbol.asyncDispose]() {
    this.#abortController.abort();
    await this.#settled;
  }

  static create(
    opencodeClient: OpencodeClient,
    floatingPromises: FloatingPromises,
    onEvent: (event: Event, signal: AbortSignal) => void | Promise<void>,
  ): OpencodeEventStream {
    return new OpencodeEventStream(opencodeClient, floatingPromises, onEvent);
  }
}
