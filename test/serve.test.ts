import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import * as createBotModule from "~/lib/create-bot";
import * as createExitHookModule from "~/lib/create-exit-hook";
import * as createOpenCodeProcessModule from "~/lib/create-opencode-process";
import { serve } from "~/lib/serve";

function mockCreateOpenCodeProcess() {
  let resolveExited: () => void;
  const exited = new Promise<void>((r) => {
    resolveExited = r;
  });
  exited.then(
    () => {},
    () => {},
  );
  const dispose = vi.fn(async () => {
    resolveExited();
  });
  vi.spyOn(
    createOpenCodeProcessModule,
    "createOpenCodeProcess",
  ).mockResolvedValue({
    exited,
    client: {} as never,
    [Symbol.asyncDispose]: dispose,
  });
  return dispose;
}

function mockCreateBot() {
  let resolveStopped: () => void;
  const stopped = new Promise<void>((r) => {
    resolveStopped = r;
  });
  stopped.then(
    () => {},
    () => {},
  );
  const dispose = vi.fn(async () => {
    resolveStopped();
  });
  vi.spyOn(createBotModule, "createBot").mockResolvedValue({
    stopped,
    client: {} as never,
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

test("serve disposes on exit", async () => {
  const disposeOpenCode = mockCreateOpenCodeProcess();
  const disposeBot = mockCreateBot();
  const triggerExit = mockCreateExitHook();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(createExitHookModule.createExitHook).toHaveBeenCalled(),
  );
  triggerExit();
  await run;
  expect(disposeOpenCode).toHaveBeenCalledOnce();
  expect(disposeBot).toHaveBeenCalledOnce();
});

test("serve exits on unexpected opencode exit", async () => {
  const exited = Promise.reject(new Error("opencode exited unexpectedly (1)"));
  exited.then(
    () => {},
    () => {},
  );
  vi.spyOn(
    createOpenCodeProcessModule,
    "createOpenCodeProcess",
  ).mockResolvedValue({
    exited,
    client: {} as never,
    [Symbol.asyncDispose]: async () => {},
  });
  mockCreateBot();
  mockCreateExitHook();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "opencode exited unexpectedly (1)",
  );
});

test("serve exits on unexpected bot stop", async () => {
  mockCreateOpenCodeProcess();
  const stopped = Promise.reject(new Error("bot stopped unexpectedly"));
  stopped.then(
    () => {},
    () => {},
  );
  vi.spyOn(createBotModule, "createBot").mockResolvedValue({
    stopped,
    client: {} as never,
    [Symbol.asyncDispose]: async () => {},
  });
  mockCreateExitHook();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "bot stopped unexpectedly",
  );
});
