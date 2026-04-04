import type { GlobalEvent } from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { FloatingPromises } from "~/lib/floating-promises";
import { logger } from "~/lib/logger";

const defaultQueueId = "default";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) return;
  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}

function opencodeEventStreamGetQueueId(event: GlobalEvent): string {
  const type: string = event.payload.type;
  const properties = asRecord(event.payload.properties);
  switch (type) {
    case "session.status":
    case "session.idle":
    case "session.compacted":
    case "session.diff":
    case "session.error":
    case "todo.updated":
    case "command.executed":
    case "question.asked":
    case "question.replied":
    case "question.rejected":
    case "permission.asked":
    case "permission.updated":
    case "permission.replied":
    case "message.removed":
    case "message.part.removed":
    case "message.part.delta": {
      const sessionId = readString(properties, "sessionID");
      return sessionId ? `session:${sessionId}` : defaultQueueId;
    }
    case "message.updated": {
      const sessionId = readString(asRecord(properties?.["info"]), "sessionID");
      return sessionId ? `session:${sessionId}` : defaultQueueId;
    }
    case "message.part.updated": {
      const sessionId = readString(asRecord(properties?.["part"]), "sessionID");
      return sessionId ? `session:${sessionId}` : defaultQueueId;
    }
    case "session.created":
    case "session.updated":
    case "session.deleted": {
      const sessionId = readString(asRecord(properties?.["info"]), "id");
      return sessionId ? `session:${sessionId}` : defaultQueueId;
    }
    default:
      return defaultQueueId;
  }
}

export class OpencodeEventStream implements AsyncDisposable {
  readonly #opencodeClient: OpencodeClient;
  readonly #floatingPromises: FloatingPromises;
  readonly #abortController: AbortController;
  readonly #closed: Promise<void>;
  readonly #settled: Promise<void>;
  readonly #queueTails = new Map<string, Promise<void>>();
  readonly #queuedEvents = new Set<Promise<void>>();
  readonly #onEvent: (
    event: GlobalEvent,
    signal: AbortSignal,
  ) => void | Promise<void>;

  private constructor(
    opencodeClient: OpencodeClient,
    floatingPromises: FloatingPromises,
    onEvent: (event: GlobalEvent, signal: AbortSignal) => void | Promise<void>,
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

  #enqueueEvent(
    event: GlobalEvent,
    onError: (error: unknown) => void,
  ): Promise<void> {
    const queueId = opencodeEventStreamGetQueueId(event);
    const previous = this.#queueTails.get(queueId) ?? Promise.resolve();
    const current = previous.then(() =>
      this.#onEvent(event, this.#abortController.signal),
    );
    current.catch((error) => {
      if (this.#abortController.signal.aborted) return;
      onError(error);
    });
    let queued: Promise<void> | undefined;
    queued = current.finally(() => {
      if (queued) this.#queuedEvents.delete(queued);
      if (queued && this.#queueTails.get(queueId) === queued) {
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
      if (failed) return;
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
          if (result.done) {
            if (failed) throw failure;
            throw new Error("OpenCode event stream ended unexpectedly");
          }
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
      if (this.#abortController.signal.aborted && !failed) {
        await this.#settleQueuedEvents();
        return;
      }
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
    onEvent: (event: GlobalEvent, signal: AbortSignal) => void | Promise<void>,
  ): OpencodeEventStream {
    return new OpencodeEventStream(opencodeClient, floatingPromises, onEvent);
  }
}
