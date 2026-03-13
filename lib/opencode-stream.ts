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
    while (!signal.aborted) {
      try {
        consola.debug("opencode event stream is connecting");
        const { stream } = await opencodeClient.event.subscribe({});
        const iter = stream[Symbol.asyncIterator]();
        const onAbort = () => {
          iter.return?.(undefined);
        };
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) onAbort();
        try {
          attempt = 0;
          consola.debug("opencode event stream is connected");
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
          iter.return?.(undefined);
        }
      } catch (error) {
        if (signal.aborted) return;
        if (attempt >= maxAttempts) throw error;
        const delay = Math.min(1000 * 2 ** attempt, maxDelay);
        consola.warn("opencode event stream disconnected, reconnecting", {
          attempt,
          delay: `${delay}ms`,
        });
        attempt++;
        await Bun.sleep(delay);
      }
    }
  }

  // run() rejects before abort (max retries exhausted — errors from subscribe,
  // onRestart, or onEvent all flow through the catch block) and only resolves
  // after abort (signal.aborted check in catch). So ended never rejects after
  // dispose.
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
