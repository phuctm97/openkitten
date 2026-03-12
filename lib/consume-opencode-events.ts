import type { Event } from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { consola } from "consola";

const maxAttempts = 10;

export async function consumeOpencodeEvents(
  opencodeClient: OpencodeClient,
  onEvent: (event: Event) => void,
  signal: AbortSignal,
): Promise<void> {
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
        for (;;) {
          const result = await iter.next();
          if (result.done) throw new Error("opencode event stream ended");
          onEvent(result.value);
        }
      } finally {
        signal.removeEventListener("abort", onAbort);
        iter.return?.(undefined);
      }
    } catch (error) {
      if (signal.aborted) return;
      if (attempt >= maxAttempts) throw error;
      const delay = Math.min(1000 * 2 ** attempt, 30_000);
      consola.warn("opencode event stream disconnected, reconnecting", {
        attempt,
        delay: `${delay}ms`,
      });
      attempt++;
      await Bun.sleep(delay);
    }
  }
}
