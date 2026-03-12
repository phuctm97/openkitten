import { runCommand } from "citty";
import { consola } from "consola";
import { expect, test, vi } from "vitest";
import * as createOpenCodeModule from "~/lib/create-opencode";
import { serve } from "~/lib/serve";

let exitHookCallback: (() => void) | undefined;

vi.mock("exit-hook", () => ({
  default: (cb: () => void) => {
    exitHookCallback = cb;
    return () => {};
  },
}));

function mockCreateOpenCode(port = 3000) {
  exitHookCallback = undefined;
  let resolveExited: () => void;
  const exited = new Promise<void>((r) => {
    resolveExited = r;
  });
  exited.catch(() => {
    // Ignore
  });
  const dispose = vi.fn(async () => {
    resolveExited();
  });
  vi.spyOn(createOpenCodeModule, "createOpenCode").mockResolvedValue({
    port,
    exited,
    [Symbol.asyncDispose]: dispose,
  });
  return dispose;
}

test("serve runs and logs port", async () => {
  const dispose = mockCreateOpenCode();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(exitHookCallback).toBeDefined());
  exitHookCallback?.();
  await run;
  expect(consola.log).toHaveBeenCalledWith(
    "opencode is listening on port 3000",
  );
  expect(dispose).toHaveBeenCalledOnce();
});

test("serve disposes on exit hook", async () => {
  const dispose = mockCreateOpenCode();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(exitHookCallback).toBeDefined());
  exitHookCallback?.();
  await run;
  expect(dispose).toHaveBeenCalledOnce();
});

test("serve exits on unexpected opencode exit", async () => {
  exitHookCallback = undefined;
  const exited = Promise.reject(
    new Error("opencode exited unexpectedly with code 1"),
  );
  exited.catch(() => {
    // Ignore
  });
  vi.spyOn(createOpenCodeModule, "createOpenCode").mockResolvedValue({
    port: 3000,
    exited,
    [Symbol.asyncDispose]: async () => {},
  });
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "opencode exited unexpectedly with code 1",
  );
});
