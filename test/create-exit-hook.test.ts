import { expect, test, vi } from "vitest";

let exitHookCallback: (() => void) | undefined;
const unsubscribe = vi.fn();

vi.mock("exit-hook", () => ({
  default: (cb: () => void) => {
    exitHookCallback = cb;
    return unsubscribe;
  },
}));

import { createExitHook } from "~/lib/create-exit-hook";

test("createExitHook resolves on exit hook", async () => {
  const hook = createExitHook();
  exitHookCallback?.();
  await expect(hook.exited).resolves.toBeUndefined();
});

test("createExitHook is disposable", () => {
  {
    using _hook = createExitHook();
  }
  expect(unsubscribe).toHaveBeenCalledOnce();
});

test("createExitHook resolves exited on dispose", async () => {
  const hook = createExitHook();
  hook[Symbol.dispose]();
  await expect(hook.exited).resolves.toBeUndefined();
});
