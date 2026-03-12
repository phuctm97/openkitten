import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import * as createExitHookModule from "~/lib/create-exit-hook";
import * as createGrammyModule from "~/lib/create-grammy";
import * as createOpencodeModule from "~/lib/create-opencode";
import { serve } from "~/lib/serve";

function mockCreateOpencode() {
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
  vi.spyOn(createOpencodeModule, "createOpencode").mockResolvedValue({
    exited,
    client: {} as never,
    [Symbol.asyncDispose]: dispose,
  });
  return dispose;
}

function mockCreateGrammy() {
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
  vi.spyOn(createGrammyModule, "createGrammy").mockResolvedValue({
    stopped,
    bot: {} as never,
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
  const disposeOpencode = mockCreateOpencode();
  const disposeGrammy = mockCreateGrammy();
  const triggerExit = mockCreateExitHook();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(createExitHookModule.createExitHook).toHaveBeenCalled(),
  );
  triggerExit();
  await run;
  expect(disposeOpencode).toHaveBeenCalledOnce();
  expect(disposeGrammy).toHaveBeenCalledOnce();
});

test("serve exits on unexpected opencode exit", async () => {
  const exited = Promise.reject(new Error("opencode exited unexpectedly (1)"));
  exited.then(
    () => {},
    () => {},
  );
  vi.spyOn(createOpencodeModule, "createOpencode").mockResolvedValue({
    exited,
    client: {} as never,
    [Symbol.asyncDispose]: async () => {},
  });
  mockCreateGrammy();
  mockCreateExitHook();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "opencode exited unexpectedly (1)",
  );
});

test("serve exits on unexpected grammy stop", async () => {
  mockCreateOpencode();
  const stopped = Promise.reject(new Error("grammy stopped unexpectedly"));
  stopped.then(
    () => {},
    () => {},
  );
  vi.spyOn(createGrammyModule, "createGrammy").mockResolvedValue({
    stopped,
    bot: {} as never,
    [Symbol.asyncDispose]: async () => {},
  });
  mockCreateExitHook();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "grammy stopped unexpectedly",
  );
});
