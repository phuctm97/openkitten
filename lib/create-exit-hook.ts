import { exitEvents } from "~/lib/exit-events";
import type { ExitHook } from "~/lib/exit-hook";

export function createExitHook(): ExitHook {
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
