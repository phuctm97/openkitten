import exitHook from "exit-hook";
import type { ExitHook } from "~/lib/exit-hook";

export function createExitHook(): ExitHook {
  const { resolve, promise: exited } = Promise.withResolvers<void>();
  const unsubscribe = exitHook(() => resolve());

  return {
    exited,
    [Symbol.dispose]() {
      resolve();
      unsubscribe();
    },
  };
}
