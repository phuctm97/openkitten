import { runCommand } from "citty";
import { consola } from "consola";
import { afterEach, expect, test, vi } from "vitest";
import * as createDatabaseModule from "~/lib/create-database";
import * as createPendingPromptsModule from "~/lib/create-pending-prompts";
import * as createTypingIndicatorsModule from "~/lib/create-typing-indicators";
import * as grammyStartModule from "~/lib/grammy-start";
import * as invalidateSessionsModule from "~/lib/invalidate-sessions";
import * as opencodeServeModule from "~/lib/opencode-serve";
import * as opencodeStreamModule from "~/lib/opencode-stream";
import { serve } from "~/lib/serve";
import * as shutdownListenModule from "~/lib/shutdown-listen";

vi.mock("grammy", () => {
  const BotMock = vi.fn(function BotMock() {
    return { on: vi.fn(), use: vi.fn() };
  });
  return { Bot: BotMock };
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function mockCreateDatabase() {
  const database = { [Symbol.dispose]() {} };
  vi.spyOn(createDatabaseModule, "createDatabase").mockReturnValue(
    database as never,
  );
  return database;
}

function mockInvalidateSessions(
  reachable: readonly unknown[] = [],
  unreachable: readonly unknown[] = [],
) {
  const mock = vi
    .spyOn(invalidateSessionsModule, "invalidateSessions")
    .mockResolvedValue({ reachable, unreachable } as never);
  return mock;
}

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
  const client = {
    session: { status: vi.fn(async () => ({ data: {} })) },
    question: { list: vi.fn(async () => ({ data: [] })) },
    permission: { list: vi.fn(async () => ({ data: [] })) },
  };
  vi.spyOn(opencodeServeModule, "opencodeServe").mockResolvedValue({
    exited,
    client: client as never,
    [Symbol.asyncDispose]: dispose,
  });
  return dispose;
}

function mockCreateTypingIndicators(sessionIds: readonly string[] = []) {
  const invalidate = vi.fn();
  const stop = vi.fn();
  const typingIndicators = {
    sessionIds,
    invalidate,
    stop,
    [Symbol.dispose]() {},
  };
  vi.spyOn(
    createTypingIndicatorsModule,
    "createTypingIndicators",
  ).mockReturnValue(typingIndicators as never);
  return { typingIndicators, invalidate, stop };
}

function mockCreatePendingPrompts(sessionIds: readonly string[] = []) {
  const invalidate = vi.fn();
  const dismiss = vi.fn();
  const pendingPrompts = {
    sessionIds,
    invalidate,
    dismiss,
    async [Symbol.asyncDispose]() {},
  };
  vi.spyOn(createPendingPromptsModule, "createPendingPrompts").mockReturnValue(
    pendingPrompts as never,
  );
  return { pendingPrompts, invalidate, dismiss };
}

function mockOpencodeStream() {
  let resolveEnded: () => void;
  const ended = new Promise<void>((r) => {
    resolveEnded = r;
  });
  ended.then(
    () => {},
    () => {},
  );
  let onRestart: () => void | Promise<void>;
  let onEvent: (event: never) => void;
  vi.spyOn(opencodeStreamModule, "opencodeStream").mockImplementation(
    (_client, restart, event) => {
      onRestart = restart;
      onEvent = event as never;
      return {
        ended,
        async [Symbol.asyncDispose]() {
          resolveEnded();
        },
      };
    },
  );
  return {
    onRestart: () => onRestart,
    onEvent: () => onEvent,
    resolveEnded: () => resolveEnded(),
  };
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

function mockAll() {
  mockCreateDatabase();
  const disposeOpencodeServer = mockOpencodeServe();
  const typing = mockCreateTypingIndicators();
  const prompts = mockCreatePendingPrompts();
  mockInvalidateSessions();
  const stream = mockOpencodeStream();
  const disposeGrammy = mockGrammyStart();
  const triggerShutdown = mockShutdownListen();
  return {
    disposeOpencodeServer,
    typing,
    prompts,
    stream,
    disposeGrammy,
    triggerShutdown,
  };
}

test("logs start and ready", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_USER_ID", "123");
  const { triggerShutdown } = mockAll();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(shutdownListenModule.shutdownListen).toHaveBeenCalled(),
  );
  triggerShutdown();
  await run;
  expect(consola.start).toHaveBeenCalledWith("OpenKitten is starting…");
  expect(consola.ready).toHaveBeenCalledWith("OpenKitten is ready");
});

test("disposes on shutdown", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_USER_ID", "123");
  const { disposeOpencodeServer, disposeGrammy, triggerShutdown } = mockAll();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(shutdownListenModule.shutdownListen).toHaveBeenCalled(),
  );
  triggerShutdown();
  await run;
  expect(disposeOpencodeServer).toHaveBeenCalledOnce();
  expect(disposeGrammy).toHaveBeenCalledOnce();
});

test("exits on unexpected opencode server exit", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_USER_ID", "123");
  mockCreateDatabase();
  const exited = Promise.reject(
    new Error("OpenCode server exited unexpectedly (1)"),
  );
  exited.then(
    () => {},
    () => {},
  );
  vi.spyOn(opencodeServeModule, "opencodeServe").mockResolvedValue({
    exited,
    client: {
      session: { status: vi.fn(async () => ({ data: {} })) },
      question: { list: vi.fn(async () => ({ data: [] })) },
      permission: { list: vi.fn(async () => ({ data: [] })) },
    } as never,
    [Symbol.asyncDispose]: async () => {},
  });
  mockCreateTypingIndicators();
  mockCreatePendingPrompts();
  mockOpencodeStream();
  mockGrammyStart();
  mockShutdownListen();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "OpenCode server exited unexpectedly (1)",
  );
});

test("exits on unexpected grammy stop", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_USER_ID", "123");
  mockCreateDatabase();
  mockOpencodeServe();
  mockCreateTypingIndicators();
  mockCreatePendingPrompts();
  mockOpencodeStream();
  const stopped = Promise.reject(new Error("grammY stopped unexpectedly"));
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
    "grammY stopped unexpectedly",
  );
});

test("exits on event stream failure", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_USER_ID", "123");
  mockCreateDatabase();
  mockOpencodeServe();
  mockCreateTypingIndicators();
  mockCreatePendingPrompts();
  const ended = Promise.reject(new Error("event stream failed"));
  ended.then(
    () => {},
    () => {},
  );
  vi.spyOn(opencodeStreamModule, "opencodeStream").mockReturnValue({
    ended,
    async [Symbol.asyncDispose]() {},
  });
  mockGrammyStart();
  mockShutdownListen();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "event stream failed",
  );
});

test("throws if TELEGRAM_BOT_TOKEN is missing", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "TELEGRAM_BOT_TOKEN is required",
  );
});

test("throws if TELEGRAM_USER_ID is missing", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_USER_ID", "");
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "TELEGRAM_USER_ID is required",
  );
});

test("throws if TELEGRAM_USER_ID is invalid", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_USER_ID", "abc");
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    'TELEGRAM_USER_ID is invalid: "abc"',
  );
});

test("onEvent is a no-op", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_USER_ID", "123");
  mockCreateDatabase();
  mockOpencodeServe();
  mockCreateTypingIndicators();
  mockCreatePendingPrompts();
  const stream = mockOpencodeStream();
  mockGrammyStart();
  const triggerShutdown = mockShutdownListen();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onEvent()).toBeDefined());

  stream.onEvent()({ type: "any-event" } as never);

  triggerShutdown();
  await run;
});

test("reconciles typing indicators on restart", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_USER_ID", "123");
  const reachable = [
    { id: "s1", chatId: 100, threadId: 0 },
    { id: "s2", chatId: 200, threadId: 5 },
  ];
  mockCreateDatabase();
  mockOpencodeServe();
  const { invalidate } = mockCreateTypingIndicators();
  mockCreatePendingPrompts();
  mockInvalidateSessions(reachable);
  const stream = mockOpencodeStream();
  mockGrammyStart();
  const triggerShutdown = mockShutdownListen();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onRestart()).toBeDefined());

  await stream.onRestart()();

  expect(invalidate).toHaveBeenCalledOnce();
  expect(invalidate).toHaveBeenCalledWith(
    expect.objectContaining({ statuses: {}, questions: [], permissions: [] }),
    ...reachable,
  );

  triggerShutdown();
  await run;
});

test("stops stale typing indicators on restart", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_USER_ID", "123");
  const reachable = [{ id: "s1", chatId: 100, threadId: 0 }];
  mockCreateDatabase();
  mockOpencodeServe();
  const { stop } = mockCreateTypingIndicators(["s1", "s-stale"]);
  mockCreatePendingPrompts();
  mockInvalidateSessions(reachable);
  const stream = mockOpencodeStream();
  mockGrammyStart();
  const triggerShutdown = mockShutdownListen();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onRestart()).toBeDefined());

  await stream.onRestart()();

  expect(stop).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledWith("s-stale");

  triggerShutdown();
  await run;
});

test("reconciles pending prompts on restart", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_USER_ID", "123");
  const reachable = [
    { id: "s1", chatId: 100, threadId: 0 },
    { id: "s2", chatId: 200, threadId: 5 },
  ];
  mockCreateDatabase();
  mockOpencodeServe();
  mockCreateTypingIndicators();
  const { invalidate } = mockCreatePendingPrompts();
  mockInvalidateSessions(reachable);
  const stream = mockOpencodeStream();
  mockGrammyStart();
  const triggerShutdown = mockShutdownListen();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onRestart()).toBeDefined());

  await stream.onRestart()();

  expect(invalidate).toHaveBeenCalledOnce();
  expect(invalidate).toHaveBeenCalledWith(
    expect.objectContaining({ statuses: {}, questions: [], permissions: [] }),
    ...reachable,
  );

  triggerShutdown();
  await run;
});

test("dismisses stale pending prompts on restart", async () => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_USER_ID", "123");
  const reachable = [{ id: "s1", chatId: 100, threadId: 0 }];
  mockCreateDatabase();
  mockOpencodeServe();
  mockCreateTypingIndicators();
  const { dismiss } = mockCreatePendingPrompts(["s1", "s-stale"]);
  mockInvalidateSessions(reachable);
  const stream = mockOpencodeStream();
  mockGrammyStart();
  const triggerShutdown = mockShutdownListen();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onRestart()).toBeDefined());

  await stream.onRestart()();

  expect(dismiss).toHaveBeenCalledOnce();
  expect(dismiss).toHaveBeenCalledWith("s-stale");

  triggerShutdown();
  await run;
});
