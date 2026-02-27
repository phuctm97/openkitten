import { runCommand } from "citty";
import { expect, test, vi } from "vitest";
import { Auth } from "~/lib/auth";
import { Database } from "~/lib/database";
import { ExistingSessions } from "~/lib/existing-sessions";
import { Grammy } from "~/lib/grammy";
import { OpencodeEventStream } from "~/lib/opencode-event-stream";
import { OpencodeServer } from "~/lib/opencode-server";
import { PendingPrompts } from "~/lib/pending-prompts";
import { ProcessingMessages } from "~/lib/processing-messages";
import { serve } from "~/lib/serve";
import { Shutdown } from "~/lib/shutdown";
import { TypingIndicators } from "~/lib/typing-indicators";
import { WorkingSessions } from "~/lib/working-sessions";

vi.mock("grammy", () => {
  const BotMock = vi.fn(function BotMock() {
    return { on: vi.fn(), use: vi.fn() };
  });
  return { Bot: BotMock };
});

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  copyFile: vi.fn(),
  writeFile: vi.fn(),
}));

function mockAuth() {
  vi.spyOn(Auth, "load").mockResolvedValue({
    telegram: { botToken: "test-token", userId: 123 },
  } as never);
}

function mockCreateDatabase() {
  const database = {
    query: { session: {} },
    [Symbol.dispose]() {},
  };
  vi.spyOn(Database, "create").mockReturnValue(database as never);
  return database;
}

function mockExistingSessions(
  sessionIds: readonly string[] = [],
  resolveMap: Record<string, ExistingSessions.Location> = {},
) {
  const invalidate = vi.fn(async () => {});
  const findOrCreate = vi.fn();
  const check = vi.fn((id: string) => id in resolveMap);
  const resolve = vi.fn((id: string) => resolveMap[id]);
  const hook = vi.fn(() => () => {});
  const remove = vi.fn(async () => {});
  const existingSessions = {
    get sessionIds() {
      return [...sessionIds];
    },
    hook,
    invalidate,
    findOrCreate,
    check,
    resolve,
    remove,
  };
  vi.spyOn(ExistingSessions, "create").mockReturnValue(
    existingSessions as never,
  );
  return { existingSessions, invalidate, resolve };
}

function mockOpencodeServer() {
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
  vi.spyOn(OpencodeServer, "create").mockResolvedValue({
    exited,
    client: client as never,
    [Symbol.asyncDispose]: dispose,
  } as never);
  return dispose;
}

function mockTypingIndicators() {
  const invalidate = vi.fn();
  const stop = vi.fn();
  const typingIndicators = {
    invalidate,
    stop,
    [Symbol.dispose]() {},
  };
  vi.spyOn(TypingIndicators, "create").mockReturnValue(
    typingIndicators as never,
  );
  return { typingIndicators, invalidate, stop };
}

function mockPendingPrompts() {
  const invalidate = vi.fn();
  const dismiss = vi.fn();
  const update = vi.fn();
  const pendingPrompts = {
    invalidate,
    dismiss,
    update,
    async [Symbol.asyncDispose]() {},
  };
  vi.spyOn(PendingPrompts, "create").mockReturnValue(pendingPrompts as never);
  return { pendingPrompts, invalidate, dismiss, update };
}

function mockWorkingSessions() {
  const update = vi.fn();
  const workingSessions = {
    invalidate: vi.fn(),
    update,
    lock: vi.fn(),
    release: vi.fn(),
    [Symbol.dispose]() {},
  };
  vi.spyOn(WorkingSessions, "create").mockReturnValue(workingSessions as never);
  return { workingSessions, update };
}

function mockProcessingMessages() {
  const invalidate = vi.fn();
  const update = vi.fn();
  const processingMessages = {
    invalidate,
    update,
    [Symbol.dispose]() {},
  };
  vi.spyOn(ProcessingMessages, "create").mockReturnValue(
    processingMessages as never,
  );
  return { processingMessages, invalidate, update };
}

function mockOpencodeEventStream() {
  let resolveClosed: () => void;
  const closed = new Promise<void>((r) => {
    resolveClosed = r;
  });
  closed.then(
    () => {},
    () => {},
  );
  let onRestart: (signal: AbortSignal) => void | Promise<void>;
  let onEvent: (event: never, signal: AbortSignal) => void;
  vi.spyOn(OpencodeEventStream, "create").mockImplementation(
    (_client, _floatingPromises, restart, event) => {
      onRestart = restart;
      onEvent = event as never;
      return {
        closed,
        async [Symbol.asyncDispose]() {
          resolveClosed();
        },
      } as never;
    },
  );
  return {
    onRestart: () => onRestart,
    onEvent: () => onEvent,
    resolveClosed: () => resolveClosed(),
  };
}

function mockGrammy() {
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
  vi.spyOn(Grammy, "create").mockResolvedValue({
    stopped,
    [Symbol.asyncDispose]: dispose,
  } as never);
  return dispose;
}

function mockShutdown() {
  let resolveSignaled: () => void;
  const signaled = new Promise<void>((r) => {
    resolveSignaled = r;
  });
  vi.spyOn(Shutdown, "create").mockReturnValue({
    signaled,
    [Symbol.dispose]() {
      resolveSignaled();
    },
  } as never);
  return () => resolveSignaled();
}

function mockAll() {
  mockAuth();
  mockCreateDatabase();
  const disposeOpencodeServer = mockOpencodeServer();
  const es = mockExistingSessions();
  const typing = mockTypingIndicators();
  const prompts = mockPendingPrompts();
  const stream = mockOpencodeEventStream();
  const disposeGrammy = mockGrammy();
  const triggerShutdown = mockShutdown();
  return {
    disposeOpencodeServer,
    es,
    typing,
    prompts,
    stream,
    disposeGrammy,
    triggerShutdown,
  };
}

test("disposes on shutdown", async () => {
  const { disposeOpencodeServer, disposeGrammy, triggerShutdown } = mockAll();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(Shutdown.create).toHaveBeenCalled());
  triggerShutdown();
  await run;
  expect(disposeOpencodeServer).toHaveBeenCalledOnce();
  expect(disposeGrammy).toHaveBeenCalledOnce();
});

test("exits on unexpected opencode server exit", async () => {
  mockAuth();
  mockCreateDatabase();
  const exited = Promise.reject(
    new Error("OpenCode server exited unexpectedly (1)"),
  );
  exited.then(
    () => {},
    () => {},
  );
  vi.spyOn(OpencodeServer, "create").mockResolvedValue({
    exited,
    client: {
      session: { status: vi.fn(async () => ({ data: {} })) },
      question: { list: vi.fn(async () => ({ data: [] })) },
      permission: { list: vi.fn(async () => ({ data: [] })) },
    } as never,
    [Symbol.asyncDispose]: async () => {},
  } as never);
  mockExistingSessions();
  mockTypingIndicators();
  mockPendingPrompts();
  mockOpencodeEventStream();
  mockGrammy();
  mockShutdown();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "OpenCode server exited unexpectedly (1)",
  );
});

test("exits on unexpected grammy stop", async () => {
  mockAuth();
  mockCreateDatabase();
  mockOpencodeServer();
  mockExistingSessions();
  mockTypingIndicators();
  mockPendingPrompts();
  mockOpencodeEventStream();
  const stopped = Promise.reject(new Error("grammY stopped unexpectedly"));
  stopped.then(
    () => {},
    () => {},
  );
  vi.spyOn(Grammy, "create").mockResolvedValue({
    stopped,
    [Symbol.asyncDispose]: async () => {},
  } as never);
  mockShutdown();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "grammY stopped unexpectedly",
  );
});

test("exits on event stream failure", async () => {
  mockAuth();
  mockCreateDatabase();
  mockOpencodeServer();
  mockExistingSessions();
  mockTypingIndicators();
  mockPendingPrompts();
  const closed = Promise.reject(new Error("event stream failed"));
  closed.then(
    () => {},
    () => {},
  );
  vi.spyOn(OpencodeEventStream, "create").mockReturnValue({
    closed,
    async [Symbol.asyncDispose]() {},
  } as never);
  mockGrammy();
  mockShutdown();
  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "event stream failed",
  );
});

test("onEvent is fire-and-forget", async () => {
  mockAuth();
  mockCreateDatabase();
  mockOpencodeServer();
  mockExistingSessions();
  mockTypingIndicators();
  mockPendingPrompts();
  const stream = mockOpencodeEventStream();
  mockGrammy();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onEvent()).toBeDefined());

  const signal = new AbortController().signal;
  const result = stream.onEvent()({ type: "any-event" } as never, signal);
  expect(result).toBeUndefined();

  triggerShutdown();
  await run;
});

test("reconciles typing indicators on restart", async () => {
  mockAuth();
  mockCreateDatabase();
  mockOpencodeServer();
  const { existingSessions } = mockExistingSessions(["s1", "s2"]);
  const { invalidate } = mockTypingIndicators();
  mockPendingPrompts();
  mockProcessingMessages();
  const stream = mockOpencodeEventStream();
  mockGrammy();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onRestart()).toBeDefined());

  await stream.onRestart()(new AbortController().signal);

  expect(existingSessions.invalidate).toHaveBeenCalledOnce();
  expect(invalidate).toHaveBeenCalledOnce();
  expect(invalidate).toHaveBeenCalledWith();

  triggerShutdown();
  await run;
});

test("reconciles pending prompts on restart", async () => {
  mockAuth();
  mockCreateDatabase();
  mockOpencodeServer();
  mockExistingSessions(["s1", "s2"]);
  mockTypingIndicators();
  const { invalidate } = mockPendingPrompts();
  mockProcessingMessages();
  const stream = mockOpencodeEventStream();
  mockGrammy();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onRestart()).toBeDefined());

  await stream.onRestart()(new AbortController().signal);

  expect(invalidate).toHaveBeenCalledOnce();
  expect(invalidate).toHaveBeenCalledWith([], []);

  triggerShutdown();
  await run;
});

test("updates working sessions on session.status event", async () => {
  mockAuth();
  mockCreateDatabase();
  mockOpencodeServer();
  mockExistingSessions(["s1"], {
    s1: { chatId: 100, threadId: undefined },
  });
  mockTypingIndicators();
  mockPendingPrompts();
  const { update } = mockWorkingSessions();
  const stream = mockOpencodeEventStream();
  mockGrammy();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onEvent()).toBeDefined());

  const event = {
    type: "session.status",
    properties: { sessionID: "s1", status: { type: "busy" } },
  };
  stream.onEvent()(event as never, new AbortController().signal);

  await vi.waitFor(() => expect(update).toHaveBeenCalledWith(event));

  triggerShutdown();
  await run;
});

test("updates pending prompts on question.asked event", async () => {
  mockAuth();
  mockCreateDatabase();
  mockOpencodeServer();
  mockExistingSessions(["s1"], {
    s1: { chatId: 100, threadId: undefined },
  });
  mockTypingIndicators();
  const { update } = mockPendingPrompts();
  const stream = mockOpencodeEventStream();
  mockGrammy();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onEvent()).toBeDefined());

  const event = {
    type: "question.asked",
    properties: { id: "q1", sessionID: "s1", questions: [] },
  };
  stream.onEvent()(event as never, new AbortController().signal);

  await vi.waitFor(() => expect(update).toHaveBeenCalledWith(event));

  triggerShutdown();
  await run;
});

test("updates pending prompts on permission.asked event", async () => {
  mockAuth();
  mockCreateDatabase();
  mockOpencodeServer();
  mockExistingSessions(["s1"], {
    s1: { chatId: 100, threadId: undefined },
  });
  mockTypingIndicators();
  const { update } = mockPendingPrompts();
  const stream = mockOpencodeEventStream();
  mockGrammy();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onEvent()).toBeDefined());

  const event = {
    type: "permission.asked",
    properties: {
      id: "p1",
      sessionID: "s1",
      permission: "bash",
      patterns: [],
      metadata: {},
      always: [],
    },
  };
  stream.onEvent()(event as never, new AbortController().signal);

  await vi.waitFor(() => expect(update).toHaveBeenCalledWith(event));

  triggerShutdown();
  await run;
});
