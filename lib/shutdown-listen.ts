import { consola } from "consola";
import type { Shutdown } from "~/lib/shutdown";
import { shutdownEvents } from "~/lib/shutdown-events";

export function shutdownListen(): Shutdown {
  const { resolve, promise: signaled } = Promise.withResolvers<void>();

  function cleanup() {
    for (const event of shutdownEvents) process.off(event, onSignal);
    process.off("message", onMessage);
  }

  let fired = false;
  function onSignal(signal?: string) {
    if (fired) return;
    fired = true;
    consola.debug("Shutdown signal is received", { signal });
    cleanup();
    resolve();
  }

  function onMessage(message: unknown) {
    if (message === "shutdown") onSignal("shutdown");
  }

  for (const event of shutdownEvents) process.once(event, onSignal);
  process.on("message", onMessage);

  return {
    signaled,
    [Symbol.dispose]: onSignal,
  };
}
