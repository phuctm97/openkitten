import exitHook from "exit-hook";

export interface ExitSignal extends Disposable {
  readonly exited: Promise<void>;
}

export function createExitSignal(): ExitSignal {
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
