import { runCommand } from "citty";
import { beforeEach, expect, test, vi } from "vitest";
import { Database } from "~/lib/database";
import { ExistingSessions } from "~/lib/existing-sessions";
import { Grammy } from "~/lib/grammy";
import { McpServer } from "~/lib/mcp-server";
import { OpencodeConfig } from "~/lib/opencode-config";
import { OpencodeEventStream } from "~/lib/opencode-event-stream";
import { OpencodeServer } from "~/lib/opencode-server";
import { PendingPrompts } from "~/lib/pending-prompts";
import { ProcessingMessages } from "~/lib/processing-messages";
import { serve } from "~/lib/serve";
import { Shutdown } from "~/lib/shutdown";
import { TelegramConfig } from "~/lib/telegram-config";
import { TypingIndicators } from "~/lib/typing-indicators";
import { WorkingSessions } from "~/lib/working-sessions";

const {
  BotMock,
  mockAutoRetry,
  mockAutoRetryTransformer,
  mockBotApiConfigUse,
} = vi.hoisted(() => {
  const mockBotApiConfigUse = vi.fn();
  const BotMock = vi.fn(function BotMock() {
    return {
      api: { config: { use: mockBotApiConfigUse } },
      command: vi.fn(),
      on: vi.fn(),
      use: vi.fn(),
    };
  });
  const mockAutoRetryTransformer = vi.fn();
  const mockAutoRetry = vi.fn(() => mockAutoRetryTransformer);
  return {
    BotMock,
    mockAutoRetry,
    mockAutoRetryTransformer,
    mockBotApiConfigUse,
  };
});

vi.mock("@grammyjs/auto-retry", () => ({
  autoRetry: mockAutoRetry,
}));

vi.mock("grammy", () => {
  return { Bot: BotMock };
});

vi.mock("node:fs/promises", async () => {
  const actual =
    await vi.importActual<typeof import("node:fs/promises")>(
      "node:fs/promises",
    );
  return {
    ...actual,
    mkdir: vi.fn(),
    copyFile: vi.fn(),
    writeFile: vi.fn(),
  };
});

beforeEach(() => {
  BotMock.mockClear();
  mockAutoRetry.mockClear();
  mockAutoRetryTransformer.mockClear();
  mockBotApiConfigUse.mockClear();
  mockAutoRetry.mockReturnValue(mockAutoRetryTransformer);
});

function mockTelegramConfig() {
  vi.spyOn(TelegramConfig, "create").mockResolvedValue({
    botToken: "test-token",
    userId: 123,
  } as never);
}

function mockOpencodeConfig() {
  vi.spyOn(OpencodeConfig, "create").mockResolvedValue({
    bin: "opencode",
    cwd: "/workspace",
    env: {},
    authorization: "Basic dGVzdDp0ZXN0",
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
  getMap: Record<string, ExistingSessions.Location> = {},
  options: { create?: Promise<unknown> } = {},
) {
  const find = vi.fn();
  const check = vi.fn((id: string) => id in getMap);
  const get = vi.fn(
    (id: string, _options: ExistingSessions.GetOptions) => getMap[id],
  );
  const hook = vi.fn(() => () => {});
  const remove = vi.fn(async () => {});
  const existingSessions = {
    get sessionIds() {
      return [...sessionIds];
    },
    hook,
    find,
    check,
    get,
    remove,
  };
  vi.spyOn(ExistingSessions, "create").mockImplementation(async () => {
    await (options.create ?? Promise.resolve());
    return existingSessions as never;
  });
  return { existingSessions, get };
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
    question: { list: vi.fn(async () => ({ data: [] })) },
    permission: { list: vi.fn(async () => ({ data: [] })) },
    session: { messages: vi.fn(async () => ({ data: [] })) },
  };
  vi.spyOn(OpencodeServer, "create").mockResolvedValue({
    exited,
    client: client as never,
    [Symbol.asyncDispose]: dispose,
  } as never);
  return dispose;
}

function mockTypingIndicators() {
  const stop = vi.fn();
  const typingIndicators = {
    stop,
    [Symbol.dispose]() {},
  };
  vi.spyOn(TypingIndicators, "create").mockReturnValue(
    typingIndicators as never,
  );
  return { typingIndicators, stop };
}

function mockPendingPrompts() {
  const dismiss = vi.fn();
  const update = vi.fn();
  const pendingPrompts = {
    dismiss,
    update,
    async [Symbol.asyncDispose]() {},
  };
  vi.spyOn(PendingPrompts, "create").mockReturnValue(pendingPrompts as never);
  return { pendingPrompts, dismiss, update };
}

function mockWorkingSessions() {
  const update = vi.fn();
  const workingSessions = {
    update,
    lock: vi.fn(),
    release: vi.fn(),
    [Symbol.dispose]() {},
  };
  vi.spyOn(WorkingSessions, "create").mockReturnValue(workingSessions as never);
  return { workingSessions, update };
}

function mockProcessingMessages() {
  const update = vi.fn();
  const processingMessages = {
    update,
    [Symbol.dispose]() {},
  };
  vi.spyOn(ProcessingMessages, "create").mockResolvedValue(
    processingMessages as never,
  );
  return { processingMessages, update };
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
  let onEvent: (event: never, signal: AbortSignal) => void;
  vi.spyOn(OpencodeEventStream, "create").mockImplementation(
    (_client, _floatingPromises, event) => {
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
    onEvent: () => onEvent,
    resolveClosed: () => resolveClosed(),
  };
}

function mockMcpServer() {
  let resolveDisconnected: () => void;
  const disconnected = new Promise<void>((r) => {
    resolveDisconnected = r;
  });
  disconnected.then(
    () => {},
    () => {},
  );
  const dispose = vi.fn(() => {
    resolveDisconnected();
  });
  vi.spyOn(McpServer, "create").mockResolvedValue({
    disconnected,
    [Symbol.dispose]: dispose,
  } as never);
  return dispose;
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
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  const disposeOpencodeServer = mockOpencodeServer();
  const disposeMcpServer = mockMcpServer();
  const es = mockExistingSessions();
  const working = mockWorkingSessions();
  const typing = mockTypingIndicators();
  const prompts = mockPendingPrompts();
  const processing = mockProcessingMessages();
  const stream = mockOpencodeEventStream();
  const disposeGrammy = mockGrammy();
  const triggerShutdown = mockShutdown();
  return {
    disposeOpencodeServer,
    disposeMcpServer,
    es,
    working,
    typing,
    prompts,
    processing,
    stream,
    disposeGrammy,
    triggerShutdown,
  };
}

test("disposes on shutdown", async () => {
  const {
    disposeOpencodeServer,
    disposeMcpServer,
    disposeGrammy,
    triggerShutdown,
  } = mockAll();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(Shutdown.create).toHaveBeenCalled());
  triggerShutdown();
  await run;
  expect(disposeOpencodeServer).toHaveBeenCalledOnce();
  expect(disposeMcpServer).toHaveBeenCalledOnce();
  expect(disposeGrammy).toHaveBeenCalledOnce();
});

test("configures auto-retry on the bot api during bootstrap", async () => {
  const { triggerShutdown } = mockAll();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(BotMock).toHaveBeenCalledOnce());
  expect(mockAutoRetry).toHaveBeenCalledOnce();
  expect(mockBotApiConfigUse).toHaveBeenCalledWith(mockAutoRetryTransformer);
  triggerShutdown();
  await run;
});

test("exits on unexpected opencode server exit", async () => {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockMcpServer();
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
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockOpencodeServer();
  mockMcpServer();
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
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockOpencodeServer();
  mockMcpServer();
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

test("awaits existing session initialization before creating working sessions", async () => {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockOpencodeServer();
  mockMcpServer();
  const { promise, resolve } = Promise.withResolvers<void>();
  mockExistingSessions([], {}, { create: promise });
  mockWorkingSessions();
  mockTypingIndicators();
  mockPendingPrompts();
  mockProcessingMessages();
  mockOpencodeEventStream();
  mockGrammy();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });

  await Bun.sleep(0);
  expect(WorkingSessions.create).not.toHaveBeenCalled();

  resolve();
  await vi.waitFor(() => expect(WorkingSessions.create).toHaveBeenCalledOnce());

  triggerShutdown();
  await run;
});

test("awaits processing message initialization before connecting event stream", async () => {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockOpencodeServer();
  mockMcpServer();
  mockExistingSessions();
  mockWorkingSessions();
  mockTypingIndicators();
  mockPendingPrompts();
  const { promise, resolve } = Promise.withResolvers<void>();
  const update = vi.fn();
  vi.spyOn(ProcessingMessages, "create").mockImplementation(async () => {
    await promise;
    return {
      update,
      [Symbol.dispose]() {},
    } as never;
  });
  mockOpencodeEventStream();
  mockGrammy();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });

  await Bun.sleep(0);
  expect(OpencodeEventStream.create).not.toHaveBeenCalled();

  resolve();
  await vi.waitFor(() => expect(OpencodeEventStream.create).toHaveBeenCalled());

  triggerShutdown();
  await run;
});

test("onEvent returns the handler promise", async () => {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockOpencodeServer();
  mockMcpServer();
  mockExistingSessions();
  mockWorkingSessions();
  mockTypingIndicators();
  mockPendingPrompts();
  mockProcessingMessages();
  const stream = mockOpencodeEventStream();
  mockGrammy();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onEvent()).toBeDefined());

  const signal = new AbortController().signal;
  const result = stream.onEvent()(
    { directory: "/tmp/a", payload: { type: "any-event" } } as never,
    signal,
  );
  await expect(result).resolves.toBeUndefined();

  triggerShutdown();
  await run;
});

test("updates working sessions on session.status event", async () => {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockOpencodeServer();
  mockMcpServer();
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
    directory: "/tmp/a",
    payload: {
      type: "session.status",
      properties: { sessionID: "s1", status: { type: "busy" } },
    },
  };
  stream.onEvent()(event as never, new AbortController().signal);

  await vi.waitFor(() => expect(update).toHaveBeenCalledWith(event.payload));

  triggerShutdown();
  await run;
});

test("passes skipActions when yes flag is set", async () => {
  const { triggerShutdown } = mockAll();
  const run = runCommand(serve, { rawArgs: ["--yes"] });

  await vi.waitFor(() =>
    expect(TelegramConfig.create).toHaveBeenCalledWith(expect.anything(), {
      skipActions: true,
    }),
  );
  expect(OpencodeConfig.create).toHaveBeenCalledWith(expect.anything(), {
    skipActions: true,
  });

  triggerShutdown();
  await run;
});

test("updates pending prompts on question.asked event", async () => {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockOpencodeServer();
  mockMcpServer();
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
    directory: "/tmp/a",
    payload: {
      type: "question.asked",
      properties: { id: "q1", sessionID: "s1", questions: [] },
    },
  };
  stream.onEvent()(event as never, new AbortController().signal);

  await vi.waitFor(() => expect(update).toHaveBeenCalledWith(event.payload));

  triggerShutdown();
  await run;
});

test("updates pending prompts on permission.asked event", async () => {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockOpencodeServer();
  mockMcpServer();
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
    directory: "/tmp/a",
    payload: {
      type: "permission.asked",
      properties: {
        id: "p1",
        sessionID: "s1",
        permission: "bash",
        patterns: [],
        metadata: {},
        always: [],
      },
    },
  };
  stream.onEvent()(event as never, new AbortController().signal);

  await vi.waitFor(() => expect(update).toHaveBeenCalledWith(event.payload));

  triggerShutdown();
  await run;
});
