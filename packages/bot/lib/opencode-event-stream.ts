import type { GlobalEvent } from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { FloatingPromises } from "~/lib/floating-promises";
import { logger } from "~/lib/logger";

function opencodeEventStreamGetQueueId(event: GlobalEvent): string {
  switch (event.payload.type) {
    case "session.status":
    case "session.idle":
    case "session.compacted":
    case "session.diff":
    case "todo.updated":
    case "command.executed":
    case "question.asked":
    case "question.replied":
    case "question.rejected":
    case "permission.asked":
    case "permission.replied":
    case "message.removed":
    case "message.part.removed":
    case "message.part.delta": {
      return `session:${event.payload.properties.sessionID}`;
    }
    case "session.error": {
      const { sessionID } = event.payload.properties;
      return sessionID ? `session:${sessionID}` : "default";
    }
    case "message.updated": {
      return `session:${event.payload.properties.info.sessionID}`;
    }
    case "message.part.updated": {
      return `session:${event.payload.properties.part.sessionID}`;
    }
    case "session.created":
    case "session.updated":
    case "session.deleted": {
      return `session:${event.payload.properties.info.id}`;
    }
    default:
      return "default";
  }
}

export class OpencodeEventStream implements AsyncDisposable {
  readonly #opencodeClient: OpencodeClient;
  readonly #floatingPromises: FloatingPromises;
  readonly #onEvent: (
    event: GlobalEvent,
    signal: AbortSignal,
  ) => void | Promise<void>;
  readonly #abortController = new AbortController();
  readonly #ended: Promise<void>;
  readonly #settled: Promise<void>;
  readonly #queueTails = new Map<string, Promise<void>>();
  readonly #queuedEvents = new Set<Promise<void>>();

  private constructor(
    opencodeClient: OpencodeClient,
    floatingPromises: FloatingPromises,
    onEvent: (event: GlobalEvent, signal: AbortSignal) => void | Promise<void>,
  ) {
    this.#opencodeClient = opencodeClient;
    this.#floatingPromises = floatingPromises;
    this.#onEvent = onEvent;

    this.#ended = this.#run();

    // ended may reject before the consumer awaits it. Without this handler,
    // the rejection would be unhandled.
    this.#settled = this.#ended.then(
      () => {},
      () => {},
    );
  }

  #enqueueEvent(
    event: GlobalEvent,
    onError: (error: unknown) => void,
  ): Promise<void> {
    const queueId = opencodeEventStreamGetQueueId(event);
    const previous = this.#queueTails.get(queueId) ?? Promise.resolve();
    const current = previous.then(async () => {
      if (this.#abortController.signal.aborted) return;
      await this.#onEvent(event, this.#abortController.signal);
    });
    current.catch((error) => {
      if (this.#abortController.signal.aborted) return;
      onError(error);
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
    return queued;
  }

  async #settleQueuedEvents(): Promise<void> {
    while (this.#queuedEvents.size > 0) {
      await Promise.allSettled(this.#queuedEvents);
    }
  }

  async #run(): Promise<void> {
    logger.debug("OpenCode event stream is connecting…");
    let failed = false;
    let failure: unknown;
    const queueFailure = Promise.withResolvers<never>();
    const fail = (error: unknown) => {
      failed = true;
      failure = error;
      queueFailure.reject(error);
      this.#abortController.abort();
    };
    try {
      const { stream } = await this.#opencodeClient.global.event({
        signal: this.#abortController.signal,
        throwOnError: true,
      });
      if (this.#abortController.signal.aborted) {
        await this.#settleQueuedEvents();
        return;
      }
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
          const result = await Promise.race([
            iter.next(),
            queueFailure.promise,
          ]);
          if (result.done)
            throw new Error("OpenCode event stream ended unexpectedly");
          this.#enqueueEvent(result.value, fail);
          // Let immediately-runnable queue work observe dispose/abort before
          // we read further ahead from the event stream.
          await Promise.resolve();
        }
      } finally {
        this.#abortController.signal.removeEventListener("abort", onAbort);
        onAbort();
      }
    } catch (error) {
      const aborted = this.#abortController.signal.aborted;
      if (!aborted) this.#abortController.abort();
      await this.#settleQueuedEvents();
      if (aborted) {
        if (failed) throw failure;
        return;
      }
      throw error;
    } finally {
      logger.info("OpenCode event stream is closed");
    }
  }

  get ended(): Promise<void> {
    return this.#ended;
  }

  async [Symbol.asyncDispose]() {
    this.#abortController.abort();
    await this.#settled;
  }

  static create(
    opencodeClient: OpencodeClient,
    floatingPromises: FloatingPromises,
    onEvent: (event: GlobalEvent, signal: AbortSignal) => void | Promise<void>,
  ): OpencodeEventStream {
    return new OpencodeEventStream(opencodeClient, floatingPromises, onEvent);
  }
}
