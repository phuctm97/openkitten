import { consola } from "consola";
import type { Shutdown } from "~/lib/shutdown";
import { shutdownEvents } from "~/lib/shutdown-events";

export function shutdownListen(): Shutdown {
  const { resolve, promise: signaled } = Promise.withResolvers<void>();

  function cleanup() {
    for (const event of shutdownEvents) process.off(event, onSignal);
    process.off("message", onMessage);
  }

  function onSignal() {
    consola.info("Shutdown signal received");
    cleanup();
    resolve();
  }

  function onMessage(message: unknown) {
    if (message === "shutdown") onSignal();
  }

  for (const event of shutdownEvents) process.once(event, onSignal);
  process.on("message", onMessage);

  return {
    signaled,
    [Symbol.dispose]: onSignal,
  };
}
