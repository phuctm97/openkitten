import { expect, test, vi } from "vitest";

let exitHookCallback: (() => void) | undefined;
const unsubscribe = vi.fn();

vi.mock("exit-hook", () => ({
  default: (cb: () => void) => {
    exitHookCallback = cb;
    return unsubscribe;
  },
}));

import { createExitSignal } from "~/lib/create-exit-signal";

test("createExitSignal resolves on exit hook", async () => {
  const signal = createExitSignal();
  exitHookCallback?.();
  await expect(signal.exited).resolves.toBeUndefined();
});

test("createExitSignal is disposable", () => {
  {
    using _signal = createExitSignal();
  }
  expect(unsubscribe).toHaveBeenCalledOnce();
});

test("createExitSignal resolves exited on dispose", async () => {
  const signal = createExitSignal();
  signal[Symbol.dispose]();
  await expect(signal.exited).resolves.toBeUndefined();
});
