import { runCommand } from "citty";
import { consola } from "consola";
import { expect, test, vi } from "vitest";
import * as createExitHookModule from "~/lib/create-exit-hook";
import * as createOpenCodeProcessModule from "~/lib/create-opencode-process";
import { serve } from "~/lib/serve";

function mockCreateOpenCodeProcess(port = 3000) {
  let resolveExited: () => void;
  const exited = new Promise<void>((r) => {
    resolveExited = r;
  });
  exited.catch(() => {});
  const dispose = vi.fn(async () => {
    resolveExited();
  });
  vi.spyOn(
    createOpenCodeProcessModule,
    "createOpenCodeProcess",
  ).mockResolvedValue({
    port,
    exited,
    [Symbol.asyncDispose]: dispose,
  });
  return dispose;
}

function mockCreateExitHook() {
  let resolveExited: () => void;
  const exited = new Promise<void>((r) => {
    resolveExited = r;
  });
  vi.spyOn(createExitHookModule, "createExitHook").mockReturnValue({
    exited,
    [Symbol.dispose]() {
      resolveExited();
    },
  });
  return () => resolveExited();
}

test("serve runs and logs port", async () => {
  const dispose = mockCreateOpenCodeProcess();
  const triggerExit = mockCreateExitHook();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(consola.ready).toHaveBeenCalledWith("opencode is listening", {
      port: 3000,
    }),
  );
  triggerExit();
  await run;
  expect(dispose).toHaveBeenCalledOnce();
});

test("serve disposes on exit", async () => {
  const dispose = mockCreateOpenCodeProcess();
  const triggerExit = mockCreateExitHook();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(createExitHookModule.createExitHook).toHaveBeenCalled(),
  );
  triggerExit();
  await run;
  expect(dispose).toHaveBeenCalledOnce();
});

test("serve exits on unexpected opencode exit", async () => {
  const exited = Promise.reject(new Error("opencode exited unexpectedly (1)"));
  exited.catch(() => {});
  vi.spyOn(
    createOpenCodeProcessModule,
    "createOpenCodeProcess",
  ).mockResolvedValue({
    port: 3000,
    exited,
    [Symbol.asyncDispose]: async () => {},
  });
  mockCreateExitHook();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "opencode exited unexpectedly (1)",
  );
});
