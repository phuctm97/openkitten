import { runCommand } from "citty";
import { beforeEach, expect, test, vi } from "vitest";
import { CommandSkills } from "~/lib/command-skills";
import { Database } from "~/lib/database";
import { ExistingSessions } from "~/lib/existing-sessions";
import { GrammyEventLoop } from "~/lib/grammy-event-loop";
import { GrammyEventStream } from "~/lib/grammy-event-stream";
import { logger } from "~/lib/logger";
import { McpServer } from "~/lib/mcp-server";
import { MediaGroupBuffer } from "~/lib/media-group-buffer";
import { OpencodeConfig } from "~/lib/opencode-config";
import { OpencodeEventStream } from "~/lib/opencode-event-stream";
import { OpencodeServer } from "~/lib/opencode-server";
import { PendingPrompts } from "~/lib/pending-prompts";
import { ProcessingMessages } from "~/lib/processing-messages";
import { Profile } from "~/lib/profile";
import { serve } from "~/lib/serve";
import { Shutdown } from "~/lib/shutdown";
import { TelegramConfig } from "~/lib/telegram-config";
import { TypingIndicators } from "~/lib/typing-indicators";
import { WorkingSessions } from "~/lib/working-sessions";

const {
  BotMock,
  MockApi,
  mockAutoRetry,
  mockAutoRetryTransformer,
  mockBotApiConfigUse,
  mockGrammyHandleMediaGroupFlush,
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
  const MockApi = vi.fn(function MockApi() {
    return { setMyCommands: vi.fn() };
  });
  const mockGrammyHandleMediaGroupFlush = vi.fn();
  return {
    BotMock,
    MockApi,
    mockAutoRetry,
    mockAutoRetryTransformer,
    mockBotApiConfigUse,
    mockGrammyHandleMediaGroupFlush,
  };
});

vi.mock("@grammyjs/auto-retry", () => ({
  autoRetry: mockAutoRetry,
}));

vi.mock("grammy", () => ({
  Bot: BotMock,
  Api: MockApi,
}));

vi.mock("~/lib/grammy-handle-media-group-flush", () => ({
  grammyHandleMediaGroupFlush: mockGrammyHandleMediaGroupFlush,
}));

vi.mock("~/lib/scheduler", () => ({
  Scheduler: {
    create: vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
    })),
  },
}));

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
  MockApi.mockClear();
  mockAutoRetry.mockClear();
  mockAutoRetryTransformer.mockClear();
  mockBotApiConfigUse.mockClear();
  mockGrammyHandleMediaGroupFlush.mockClear();
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
  vi.spyOn(CommandSkills, "list").mockResolvedValue([]);
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

function createMockOpencodeClient() {
  return {
    question: { list: vi.fn(async () => ({ data: [] })) },
    permission: { list: vi.fn(async () => ({ data: [] })) },
    session: { messages: vi.fn(async () => ({ data: [] })) },
  };
}

function mockOpencodeServer() {
  const dispose = vi.fn(async () => {
    return;
  });
  vi.spyOn(OpencodeServer, "create").mockImplementation(async () => {
    const { resolve, promise: exited } = Promise.withResolvers<void>();
    exited.then(
      () => {},
      () => {},
    );
    return {
      exited,
      client: createMockOpencodeClient() as never,
      [Symbol.asyncDispose]: async () => {
        dispose();
        resolve();
      },
    } as never;
  });
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
  const onEvents: Array<(event: never, signal: AbortSignal) => void> = [];
  const resolves: Array<() => void> = [];
  vi.spyOn(OpencodeEventStream, "create").mockImplementation(
    (_client, _floatingPromises, event) => {
      const { resolve, promise: ended } = Promise.withResolvers<void>();
      ended.then(
        () => {},
        () => {},
      );
      onEvents.push(event as never);
      resolves.push(resolve);
      return {
        ended,
        async [Symbol.asyncDispose]() {
          resolve();
        },
      } as never;
    },
  );
  return {
    onEvent: () => onEvents.at(-1),
    resolveEnded: () => {
      const resolve = resolves.at(-1);
      if (resolve) resolve();
    },
  };
}

function mockMcpServer() {
  const dispose = vi.fn(() => {
    return;
  });
  vi.spyOn(McpServer, "create").mockImplementation(async () => {
    const { resolve, promise: exited } = Promise.withResolvers<void>();
    exited.then(
      () => {},
      () => {},
    );
    return {
      exited,
      [Symbol.dispose]: () => {
        dispose();
        resolve();
      },
    } as never;
  });
  return dispose;
}

function mockGrammyEventStream() {
  const dispose = vi.fn(async () => {
    return;
  });
  vi.spyOn(GrammyEventStream, "create").mockImplementation(async () => {
    const { resolve, promise: ended } = Promise.withResolvers<void>();
    ended.then(
      () => {},
      () => {},
    );
    return {
      ended,
      [Symbol.asyncDispose]: async () => {
        dispose();
        resolve();
      },
    } as never;
  });
  return dispose;
}

function mockGrammyEventLoop() {
  const rejects: Array<(reason?: unknown) => void> = [];
  const dispose = vi.fn(async () => {});
  vi.spyOn(GrammyEventLoop, "create").mockImplementation(() => {
    const ended = new Promise<void>((_, reject) => {
      rejects.push(reject);
    });
    ended.then(
      () => {},
      () => {},
    );
    return {
      ended,
      connect: vi.fn(() => vi.fn()),
      [Symbol.asyncDispose]: dispose,
    } as never;
  });
  return {
    rejectEnded: (error: unknown) => {
      const reject = rejects.at(-1);
      if (reject) reject(error);
    },
    dispose,
  };
}

function mockShutdown() {
  const triggers: Array<(event?: string) => void> = [];
  vi.spyOn(Shutdown, "create").mockImplementation(() => {
    const controller = new AbortController();
    let resolveSignaled: (value: typeof Shutdown.symbol | undefined) => void;
    const signaled = new Promise<typeof Shutdown.symbol | undefined>((r) => {
      resolveSignaled = r;
    });
    const trigger = (event?: string) => {
      if (controller.signal.aborted) return;
      controller.abort();
      resolveSignaled(event ? Shutdown.symbol : undefined);
    };
    triggers.push(trigger);
    return {
      signal: controller.signal,
      signaled,
      trigger,
      [Symbol.dispose]() {
        trigger();
      },
    } as never;
  });
  return {
    triggerLatest(event = "SIGINT") {
      const trigger = triggers.at(-1);
      if (trigger) trigger(event);
    },
    triggerLatestEmpty() {
      const trigger = triggers.at(-1);
      if (trigger) trigger();
    },
  };
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
  const grammyEventLoop = mockGrammyEventLoop();
  const disposeGrammyEventStream = mockGrammyEventStream();
  const shutdown = mockShutdown();
  return {
    disposeOpencodeServer,
    disposeMcpServer,
    es,
    working,
    typing,
    prompts,
    processing,
    stream,
    grammyEventLoop,
    disposeGrammyEventStream,
    shutdown,
  };
}

test("disposes on shutdown", async () => {
  const {
    disposeOpencodeServer,
    disposeMcpServer,
    disposeGrammyEventStream,
    shutdown,
  } = mockAll();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(Shutdown.create).toHaveBeenCalled());
  shutdown.triggerLatest();
  await run;
  expect(disposeOpencodeServer).toHaveBeenCalledOnce();
  expect(disposeMcpServer).toHaveBeenCalledOnce();
  expect(disposeGrammyEventStream).toHaveBeenCalledOnce();
});

test("configures auto-retry on the bot api during bootstrap", async () => {
  const { shutdown } = mockAll();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(BotMock).toHaveBeenCalledOnce());
  expect(mockAutoRetry).toHaveBeenCalledOnce();
  expect(mockBotApiConfigUse).toHaveBeenCalledWith(mockAutoRetryTransformer);
  shutdown.triggerLatest();
  await run;
});

test("restarts on unexpected opencode server exit", async () => {
  vi.spyOn(Profile, "create");
  const { shutdown } = mockAll();
  const exited = Promise.reject(
    new Error("OpenCode server exited unexpectedly (1)"),
  );
  exited.then(
    () => {},
    () => {},
  );
  vi.mocked(OpencodeServer.create).mockResolvedValueOnce({
    exited,
    client: createMockOpencodeClient() as never,
    [Symbol.asyncDispose]: async () => {},
  } as never);
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(OpencodeServer.create).toHaveBeenCalledTimes(2),
  );
  expect(Profile.create).toHaveBeenCalledTimes(2);
  expect(TelegramConfig.create).toHaveBeenNthCalledWith(1, expect.anything(), {
    skipActions: false,
  });
  expect(TelegramConfig.create).toHaveBeenNthCalledWith(2, expect.anything(), {
    skipActions: true,
  });
  expect(OpencodeConfig.create).toHaveBeenNthCalledWith(1, expect.anything(), {
    skipActions: false,
  });
  expect(OpencodeConfig.create).toHaveBeenNthCalledWith(2, expect.anything(), {
    skipActions: true,
  });
  shutdown.triggerLatest();
  await run;
});

test("restarts on unexpected grammY event stream end", async () => {
  const { shutdown } = mockAll();
  const ended = Promise.reject(
    new Error("grammY event stream ended unexpectedly"),
  );
  ended.then(
    () => {},
    () => {},
  );
  vi.mocked(GrammyEventStream.create).mockResolvedValueOnce({
    ended,
    [Symbol.asyncDispose]: async () => {},
  } as never);
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(GrammyEventStream.create).toHaveBeenCalledTimes(2),
  );
  shutdown.triggerLatest();
  await run;
});

test("restarts on event stream failure", async () => {
  const { shutdown } = mockAll();
  const ended = Promise.reject(new Error("event stream failed"));
  ended.then(
    () => {},
    () => {},
  );
  vi.mocked(OpencodeEventStream.create).mockReturnValueOnce({
    ended,
    async [Symbol.asyncDispose]() {},
  } as never);
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(OpencodeEventStream.create).toHaveBeenCalledTimes(2),
  );
  shutdown.triggerLatest();
  await run;
});

test("restarts on grammY event loop failure", async () => {
  const { grammyEventLoop, disposeGrammyEventStream, shutdown } = mockAll();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(GrammyEventLoop.create).toHaveBeenCalledOnce());

  grammyEventLoop.rejectEnded(new Error("grammY event loop failed"));

  await vi.waitFor(() =>
    expect(GrammyEventLoop.create).toHaveBeenCalledTimes(2),
  );
  shutdown.triggerLatest();
  await run;
  expect(disposeGrammyEventStream).toHaveBeenCalledTimes(2);
  expect(grammyEventLoop.dispose).toHaveBeenCalledTimes(2);
});

test("restarts when shutdown resolves without a signal", async () => {
  const { shutdown } = mockAll();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(Shutdown.create).toHaveBeenCalledOnce());

  shutdown.triggerLatestEmpty();

  await vi.waitFor(() => expect(Shutdown.create).toHaveBeenCalledTimes(2));

  shutdown.triggerLatest();
  await run;
});

test("stops restarting after repeated unexpected failures", async () => {
  const error = new Error("OpenCode server exited unexpectedly (1)");
  mockAll();
  vi.mocked(OpencodeServer.create).mockImplementation(async () => {
    const exited = Promise.reject(error);
    exited.then(
      () => {},
      () => {},
    );
    return {
      exited,
      client: createMockOpencodeClient() as never,
      [Symbol.asyncDispose]: async () => {},
    } as never;
  });

  await expect(runCommand(serve, { rawArgs: [] })).rejects.toThrow(
    "OpenCode server exited unexpectedly (1)",
  );
  expect(OpencodeServer.create).toHaveBeenCalledTimes(5);
});

test("awaits existing session initialization before creating working sessions", async () => {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockOpencodeServer();
  mockMcpServer();
  const { resolve, promise } = Promise.withResolvers<void>();
  mockExistingSessions([], {}, { create: promise });
  mockWorkingSessions();
  mockTypingIndicators();
  mockPendingPrompts();
  mockProcessingMessages();
  mockOpencodeEventStream();
  mockGrammyEventLoop();
  mockGrammyEventStream();
  const shutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });

  await Bun.sleep(0);
  expect(WorkingSessions.create).not.toHaveBeenCalled();

  resolve();
  await vi.waitFor(() => expect(WorkingSessions.create).toHaveBeenCalledOnce());

  shutdown.triggerLatest();
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
  const { resolve, promise } = Promise.withResolvers<void>();
  const update = vi.fn();
  vi.spyOn(ProcessingMessages, "create").mockImplementation(async () => {
    await promise;
    return {
      update,
      [Symbol.dispose]() {},
    } as never;
  });
  mockOpencodeEventStream();
  mockGrammyEventLoop();
  mockGrammyEventStream();
  const shutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });

  await Bun.sleep(0);
  expect(OpencodeEventStream.create).not.toHaveBeenCalled();

  resolve();
  await vi.waitFor(() => expect(OpencodeEventStream.create).toHaveBeenCalled());

  shutdown.triggerLatest();
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
  mockGrammyEventLoop();
  mockGrammyEventStream();
  const shutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onEvent()).toBeDefined());

  const signal = new AbortController().signal;
  const onEvent = stream.onEvent();
  if (!onEvent) throw new Error("Expected OpenCode event handler");
  const result = onEvent(
    { directory: "/tmp/a", payload: { type: "any-event" } } as never,
    signal,
  );
  await expect(result).resolves.toBeUndefined();

  shutdown.triggerLatest();
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
  mockProcessingMessages();
  const stream = mockOpencodeEventStream();
  mockGrammyEventLoop();
  mockGrammyEventStream();
  const shutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onEvent()).toBeDefined());

  const event = {
    directory: "/tmp/a",
    payload: {
      type: "session.status",
      properties: { sessionID: "s1", status: { type: "busy" } },
    },
  };
  const onEvent = stream.onEvent();
  if (!onEvent) throw new Error("Expected OpenCode event handler");
  onEvent(event as never, new AbortController().signal);

  await vi.waitFor(() => expect(update).toHaveBeenCalledWith(event.payload));

  shutdown.triggerLatest();
  await run;
});

test("passes yes option when yes flag is set", async () => {
  const { shutdown } = mockAll();
  const run = runCommand(serve, { rawArgs: ["--yes"] });

  await vi.waitFor(() =>
    expect(TelegramConfig.create).toHaveBeenCalledWith(expect.anything(), {
      skipActions: true,
    }),
  );
  expect(OpencodeConfig.create).toHaveBeenCalledWith(expect.anything(), {
    skipActions: true,
  });

  shutdown.triggerLatest();
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
  mockWorkingSessions();
  mockTypingIndicators();
  const { update } = mockPendingPrompts();
  mockProcessingMessages();
  const stream = mockOpencodeEventStream();
  mockGrammyEventLoop();
  mockGrammyEventStream();
  const shutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onEvent()).toBeDefined());

  const event = {
    directory: "/tmp/a",
    payload: {
      type: "question.asked",
      properties: { id: "q1", sessionID: "s1", questions: [] },
    },
  };
  const onEvent = stream.onEvent();
  if (!onEvent) throw new Error("Expected OpenCode event handler");
  onEvent(event as never, new AbortController().signal);

  await vi.waitFor(() => expect(update).toHaveBeenCalledWith(event.payload));

  shutdown.triggerLatest();
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
  mockWorkingSessions();
  mockTypingIndicators();
  const { update } = mockPendingPrompts();
  mockProcessingMessages();
  const stream = mockOpencodeEventStream();
  mockGrammyEventLoop();
  mockGrammyEventStream();
  const shutdown = mockShutdown();

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
  const onEvent = stream.onEvent();
  if (!onEvent) throw new Error("Expected OpenCode event handler");
  onEvent(event as never, new AbortController().signal);

  await vi.waitFor(() => expect(update).toHaveBeenCalledWith(event.payload));

  shutdown.triggerLatest();
  await run;
});

test("media group flush callback delegates to grammyHandleMediaGroupFlush", async () => {
  vi.spyOn(MediaGroupBuffer, "create");
  mockGrammyHandleMediaGroupFlush.mockResolvedValue(undefined);
  const { shutdown } = mockAll();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(MediaGroupBuffer.create).toHaveBeenCalledOnce(),
  );

  const call = vi.mocked(MediaGroupBuffer.create).mock.calls[0];
  if (!call) throw new Error("Expected MediaGroupBuffer.create to be called");
  const onFlush = call[1];
  const entries = [
    {
      chatId: 42,
      threadId: undefined,
      messageId: 1,
      download: async () => [{ type: "text" as const, text: "hello" }],
    },
  ];
  await onFlush(entries);
  expect(mockGrammyHandleMediaGroupFlush).toHaveBeenCalledWith(
    expect.objectContaining({}),
    entries,
  );

  shutdown.triggerLatest();
  await run;
});

test("media group flush callback triggers shutdown on error", async () => {
  vi.spyOn(MediaGroupBuffer, "create");
  vi.spyOn(logger, "fatal");
  const flushError = new Error("flush failed");
  mockGrammyHandleMediaGroupFlush.mockRejectedValue(flushError);
  const { shutdown } = mockAll();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() =>
    expect(MediaGroupBuffer.create).toHaveBeenCalledOnce(),
  );

  const call = vi.mocked(MediaGroupBuffer.create).mock.calls[0];
  if (!call) throw new Error("Expected MediaGroupBuffer.create to be called");
  const onFlush = call[1];
  await onFlush([]);

  expect(logger.fatal).toHaveBeenCalledWith(
    "Media group flush failed",
    flushError,
  );

  // shutdown.trigger() without args causes restart — stop the loop with a signal
  await vi.waitFor(() =>
    expect(MediaGroupBuffer.create).toHaveBeenCalledTimes(2),
  );
  shutdown.triggerLatest();
  await run;
});
