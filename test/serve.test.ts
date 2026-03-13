import { runCommand } from "citty";
import { afterEach, expect, test, vi } from "vitest";
import * as createExitModule from "~/lib/create-exit";
import * as createOpencodeModule from "~/lib/create-opencode";
import { serve } from "~/lib/serve";
import * as startGrammyModule from "~/lib/start-grammy";

vi.mock("grammy", () => ({
  Bot: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

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

function mockStartGrammy() {
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
  vi.spyOn(startGrammyModule, "startGrammy").mockResolvedValue({
    stopped,
    [Symbol.asyncDispose]: dispose,
  });
  return dispose;
}

function mockCreateExit() {
  let resolveExited: () => void;
  const exited = new Promise<void>((r) => {
    resolveExited = r;
  });
  vi.spyOn(createExitModule, "createExit").mockReturnValue({
    exited,
    [Symbol.dispose]() {
      resolveExited();
    },
  });
  return () => resolveExited();
}

test("disposes on exit", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  const disposeOpencode = mockCreateOpencode();
  const disposeGrammy = mockStartGrammy();
  const triggerExit = mockCreateExit();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(createExitModule.createExit).toHaveBeenCalled(),
  );
  triggerExit();
  await run;
  expect(disposeOpencode).toHaveBeenCalledOnce();
  expect(disposeGrammy).toHaveBeenCalledOnce();
});

test("exits on unexpected opencode exit", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
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
  mockStartGrammy();
  mockCreateExit();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "opencode exited unexpectedly (1)",
  );
});

test("exits on unexpected grammy stop", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  mockCreateOpencode();
  const stopped = Promise.reject(new Error("grammy stopped unexpectedly"));
  stopped.then(
    () => {},
    () => {},
  );
  vi.spyOn(startGrammyModule, "startGrammy").mockResolvedValue({
    stopped,
    [Symbol.asyncDispose]: async () => {},
  });
  mockCreateExit();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "grammy stopped unexpectedly",
  );
});

test("throws if TELEGRAM_BOT_TOKEN is missing", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "TELEGRAM_BOT_TOKEN is required",
  );
});
