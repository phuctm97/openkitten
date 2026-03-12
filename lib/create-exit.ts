import type { Exit } from "~/lib/exit";
import { exitEvents } from "~/lib/exit-events";

export function createExit(): Exit {
  const { resolve, promise: exited } = Promise.withResolvers<void>();

  function cleanup() {
    for (const event of exitEvents) process.off(event, onExit);
    process.off("message", onMessage);
  }

  function onExit() {
    cleanup();
    resolve();
  }

  function onMessage(message: unknown) {
    if (message === "shutdown") onExit();
  }

  for (const event of exitEvents) process.once(event, onExit);
  process.on("message", onMessage);

  return {
    exited,
    [Symbol.dispose]: onExit,
  };
}
