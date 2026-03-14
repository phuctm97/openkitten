import type { Event } from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { consola } from "consola";
import type { OpencodeEventStream } from "~/lib/opencode-event-stream";

const maxAttempts = 10;
const maxDelay = 30_000;

export function opencodeStream(
  opencodeClient: OpencodeClient,
  onRestart: () => void | Promise<void>,
  onEvent: (event: Event) => void | Promise<void>,
): OpencodeEventStream {
  const controller = new AbortController();
  const { signal } = controller;

  async function run(): Promise<void> {
    let attempt = 0;
    for (;;) {
      try {
        if (signal.aborted) break;
        consola.start("OpenCode event stream is connecting");
        const { stream } = await opencodeClient.event.subscribe({}, { signal });
        const iter = stream[Symbol.asyncIterator]();
        const onAbort = () => {
          iter.return?.(undefined);
        };
        try {
          signal.addEventListener("abort", onAbort, { once: true });
          consola.ready("OpenCode event stream is connected");
          attempt = 0;
          // onRestart errors are treated as stream failures and trigger reconnection.
          await onRestart();
          for (;;) {
            const result = await iter.next();
            if (result.done) throw new Error("opencode event stream ended");
            // onEvent errors are treated as stream failures and trigger reconnection.
            await onEvent(result.value);
          }
        } finally {
          signal.removeEventListener("abort", onAbort);
          onAbort();
        }
      } catch (error) {
        if (signal.aborted) break;
        if (attempt >= maxAttempts) throw error;
        const delay = Math.min(1000 * 2 ** attempt, maxDelay);
        consola.warn("OpenCode event stream disconnected, reconnecting", {
          attempt,
          delay,
        });
        attempt++;
        const { resolve, promise: aborted } = Promise.withResolvers<void>();
        const onAbort = () => resolve();
        try {
          signal.addEventListener("abort", onAbort, { once: true });
          await Promise.race([Bun.sleep(delay), aborted]);
        } finally {
          signal.removeEventListener("abort", onAbort);
          onAbort();
        }
      }
    }
    consola.debug("OpenCode event stream stopped");
  }

  // run() rejects before abort (max retries exhausted) and only resolves after
  // abort (signal.aborted breaks in try and catch). So ended never rejects
  // after dispose.
  const ended = run();

  // ended rejects on max reconnect attempts but may not be awaited immediately
  // by the consumer. Without this handler, the rejection would be unhandled.
  const settled = ended.then(
    () => {},
    () => {},
  );

  return {
    ended,
    async [Symbol.asyncDispose]() {
      controller.abort();
      await settled;
    },
  };
}
