import { runCommand } from "citty";
import { afterEach, expect, test, vi } from "vitest";
import * as grammyStartModule from "~/lib/grammy-start";
import * as opencodeServeModule from "~/lib/opencode-serve";
import { serve } from "~/lib/serve";
import * as shutdownListenModule from "~/lib/shutdown-listen";

vi.mock("grammy", () => ({
  Bot: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

function mockOpencodeServe() {
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
  vi.spyOn(opencodeServeModule, "opencodeServe").mockResolvedValue({
    exited,
    client: {} as never,
    [Symbol.asyncDispose]: dispose,
  });
  return dispose;
}

function mockGrammyStart() {
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
  vi.spyOn(grammyStartModule, "grammyStart").mockResolvedValue({
    stopped,
    [Symbol.asyncDispose]: dispose,
  });
  return dispose;
}

function mockShutdownListen() {
  let resolveSignaled: () => void;
  const signaled = new Promise<void>((r) => {
    resolveSignaled = r;
  });
  vi.spyOn(shutdownListenModule, "shutdownListen").mockReturnValue({
    signaled,
    [Symbol.dispose]() {
      resolveSignaled();
    },
  });
  return () => resolveSignaled();
}

test("disposes on shutdown", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  const disposeOpencode = mockOpencodeServe();
  const disposeGrammy = mockGrammyStart();
  const triggerShutdown = mockShutdownListen();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(shutdownListenModule.shutdownListen).toHaveBeenCalled(),
  );
  triggerShutdown();
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
  vi.spyOn(opencodeServeModule, "opencodeServe").mockResolvedValue({
    exited,
    client: {} as never,
    [Symbol.asyncDispose]: async () => {},
  });
  mockGrammyStart();
  mockShutdownListen();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "opencode exited unexpectedly (1)",
  );
});

test("exits on unexpected grammy stop", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  mockOpencodeServe();
  const stopped = Promise.reject(new Error("grammy stopped unexpectedly"));
  stopped.then(
    () => {},
    () => {},
  );
  vi.spyOn(grammyStartModule, "grammyStart").mockResolvedValue({
    stopped,
    [Symbol.asyncDispose]: async () => {},
  });
  mockShutdownListen();
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
