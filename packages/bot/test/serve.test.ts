import { runCommand } from "citty";
import { beforeEach, expect, test, vi } from "vitest";
import { Database } from "~/lib/database";
import { ExistingSessions } from "~/lib/existing-sessions";
import { GrammyEventLoop } from "~/lib/grammy-event-loop";
import { GrammyEventStream } from "~/lib/grammy-event-stream";
import { logger } from "~/lib/logger";
import { McpServer } from "~/lib/mcp-server";
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
  vi.restoreAllMocks();
  BotMock.mockClear();
  mockAutoRetry.mockClear();
  mockAutoRetryTransformer.mockClear();
  mockBotApiConfigUse.mockClear();
  mockAutoRetry.mockReturnValue(mockAutoRetryTransformer);
  vi.spyOn(logger, "fatal").mockImplementation((() => {}) as never);
});

function latestValue<T>(values: T[], name: string): T {
  const value = values.at(-1);
  if (value === undefined) throw new Error(`${name} is not ready`);
  return value;
}

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
  const exits: Array<{
    resolve: () => void;
    reject: (error: unknown) => void;
  }> = [];
  const dispose = vi.fn(async () => {});
  const client = {
    question: { list: vi.fn(async () => ({ data: [] })) },
    permission: { list: vi.fn(async () => ({ data: [] })) },
    session: { messages: vi.fn(async () => ({ data: [] })) },
  };
  vi.spyOn(OpencodeServer, "create").mockImplementation(async () => {
    let resolveExited = () => {};
    let rejectExited = (_error: unknown) => {};
    const exited = new Promise<void>((resolve, reject) => {
      resolveExited = () => resolve();
      rejectExited = reject;
    });
    exited.then(
      () => {},
      () => {},
    );
    exits.push({
      resolve: resolveExited,
      reject: rejectExited,
    });
    return {
      exited,
      client: client as never,
      async [Symbol.asyncDispose]() {
        dispose();
        resolveExited();
      },
    } as never;
  });
  return {
    dispose,
    exit: () => latestValue(exits, "OpenCode server").resolve(),
    fail: (error: unknown) =>
      latestValue(exits, "OpenCode server").reject(error),
    count: () => exits.length,
  };
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
  const instances: Array<{
    onEvent: (event: never, signal: AbortSignal) => void;
    resolve: () => void;
    reject: (error: unknown) => void;
  }> = [];
  vi.spyOn(OpencodeEventStream, "create").mockImplementation(
    (_client, _floatingPromises, event) => {
      let resolveEnded = () => {};
      let rejectEnded = (_error: unknown) => {};
      const ended = new Promise<void>((resolve, reject) => {
        resolveEnded = () => resolve();
        rejectEnded = reject;
      });
      ended.then(
        () => {},
        () => {},
      );
      instances.push({
        onEvent: event as never,
        resolve: resolveEnded,
        reject: rejectEnded,
      });
      return {
        ended,
        async [Symbol.asyncDispose]() {
          resolveEnded();
        },
      } as never;
    },
  );
  return {
    onEvent: () => latestValue(instances, "OpenCode event stream").onEvent,
    resolveEnded: () =>
      latestValue(instances, "OpenCode event stream").resolve(),
    rejectEnded: (error: unknown) =>
      latestValue(instances, "OpenCode event stream").reject(error),
    count: () => instances.length,
  };
}

function mockMcpServer() {
  const exits: Array<() => void> = [];
  const dispose = vi.fn(() => {});
  vi.spyOn(McpServer, "create").mockImplementation(async () => {
    let resolveExited = () => {};
    const exited = new Promise<void>((resolve) => {
      resolveExited = () => resolve();
    });
    exited.then(
      () => {},
      () => {},
    );
    exits.push(resolveExited);
    return {
      exited,
      [Symbol.dispose]() {
        dispose();
        resolveExited();
      },
    } as never;
  });
  return {
    dispose,
    exit: () => latestValue(exits, "MCP server")(),
    count: () => exits.length,
  };
}

function mockGrammyEventStream() {
  const instances: Array<{
    resolve: () => void;
    reject: (error: unknown) => void;
  }> = [];
  const dispose = vi.fn(async () => {});
  vi.spyOn(GrammyEventStream, "create").mockImplementation(async () => {
    let resolveEnded = () => {};
    let rejectEnded = (_error: unknown) => {};
    const ended = new Promise<void>((resolve, reject) => {
      resolveEnded = () => resolve();
      rejectEnded = reject;
    });
    ended.then(
      () => {},
      () => {},
    );
    instances.push({
      resolve: resolveEnded,
      reject: rejectEnded,
    });
    return {
      ended,
      async [Symbol.asyncDispose]() {
        dispose();
        resolveEnded();
      },
    } as never;
  });
  return {
    dispose,
    end: () => latestValue(instances, "grammY event stream").resolve(),
    fail: (error: unknown) =>
      latestValue(instances, "grammY event stream").reject(error),
    count: () => instances.length,
  };
}

function mockGrammyEventLoop() {
  const dispose = vi.fn(async () => {});
  const rejects: Array<(reason?: unknown) => void> = [];
  vi.spyOn(GrammyEventLoop, "create").mockImplementation(() => {
    let rejectEnded = (_reason?: unknown) => {};
    const ended = new Promise<void>((_, reject) => {
      rejectEnded = reject;
    });
    ended.then(
      () => {},
      () => {},
    );
    rejects.push(rejectEnded);
    return {
      ended,
      connect: vi.fn(() => vi.fn()),
      [Symbol.asyncDispose]: dispose,
    } as never;
  });
  return {
    rejectEnded: (error: unknown) =>
      latestValue(rejects, "grammY event loop")(error),
    dispose,
    count: () => rejects.length,
  };
}

interface ShutdownTrigger {
  (event?: string): void;
  count(): number;
}

function mockShutdown(): ShutdownTrigger {
  const resolvers: Array<(event?: string) => void> = [];
  vi.spyOn(Shutdown, "create").mockImplementation(() => {
    let resolveSignaled = (_event?: string) => {};
    const signaled = new Promise<typeof Shutdown.symbol | undefined>(
      (resolve) => {
        resolveSignaled = (event?: string) =>
          resolve(event ? Shutdown.symbol : undefined);
      },
    );
    resolvers.push(resolveSignaled);
    return {
      signaled,
      [Symbol.dispose]() {
        resolveSignaled();
      },
    } as never;
  });
  return Object.assign(
    (event?: string) => latestValue(resolvers, "Shutdown")(event),
    {
      count: () => resolvers.length,
    },
  );
}

function mockAll() {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  const opencodeServer = mockOpencodeServer();
  const mcpServer = mockMcpServer();
  const es = mockExistingSessions();
  const working = mockWorkingSessions();
  const typing = mockTypingIndicators();
  const prompts = mockPendingPrompts();
  const processing = mockProcessingMessages();
  const stream = mockOpencodeEventStream();
  const grammyEventStream = mockGrammyEventStream();
  const triggerShutdown = mockShutdown();
  return {
    opencodeServer,
    mcpServer,
    es,
    working,
    typing,
    prompts,
    processing,
    stream,
    grammyEventStream,
    triggerShutdown,
  };
}

test("disposes on shutdown", async () => {
  const { opencodeServer, mcpServer, grammyEventStream, triggerShutdown } =
    mockAll();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(Shutdown.create).toHaveBeenCalled());
  triggerShutdown("SIGTERM");
  await run;
  expect(opencodeServer.dispose).toHaveBeenCalledOnce();
  expect(mcpServer.dispose).toHaveBeenCalledOnce();
  expect(grammyEventStream.dispose).toHaveBeenCalledOnce();
});

test("restarts on internal shutdown request", async () => {
  vi.spyOn(Profile, "create");
  const { opencodeServer, mcpServer, grammyEventStream, triggerShutdown } =
    mockAll();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(Shutdown.create).toHaveBeenCalled());
  triggerShutdown();
  await vi.waitFor(() => expect(triggerShutdown.count()).toBe(2));
  expect(logger.fatal).toHaveBeenCalledOnce();
  expect(logger.fatal).toHaveBeenCalledWith(
    "OpenKitten server stopped unexpectedly, restarting…",
  );
  triggerShutdown("SIGTERM");
  await run;
  expect(Profile.create).toHaveBeenCalledTimes(2);
  expect(TelegramConfig.create).toHaveBeenNthCalledWith(1, expect.anything(), {
    skipActions: false,
  });
  expect(TelegramConfig.create).toHaveBeenNthCalledWith(2, expect.anything(), {
    skipActions: true,
  });
  expect(TelegramConfig.create).toHaveBeenCalledTimes(2);
  expect(OpencodeConfig.create).toHaveBeenNthCalledWith(1, expect.anything(), {
    skipActions: false,
  });
  expect(OpencodeConfig.create).toHaveBeenNthCalledWith(2, expect.anything(), {
    skipActions: true,
  });
  expect(OpencodeConfig.create).toHaveBeenCalledTimes(2);
  expect(opencodeServer.dispose).toHaveBeenCalledTimes(2);
  expect(mcpServer.dispose).toHaveBeenCalledTimes(2);
  expect(grammyEventStream.dispose).toHaveBeenCalledTimes(2);
});

test("configures auto-retry on the bot api during bootstrap", async () => {
  const { triggerShutdown } = mockAll();
  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(BotMock).toHaveBeenCalledOnce());
  expect(mockAutoRetry).toHaveBeenCalledOnce();
  expect(mockBotApiConfigUse).toHaveBeenCalledWith(mockAutoRetryTransformer);
  triggerShutdown("SIGTERM");
  await run;
});

test("restarts on unexpected opencode server exit", async () => {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  const opencodeServer = mockOpencodeServer();
  mockMcpServer();
  mockExistingSessions();
  mockTypingIndicators();
  mockPendingPrompts();
  mockProcessingMessages();
  mockOpencodeEventStream();
  mockGrammyEventStream();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(opencodeServer.count()).toBe(1));

  opencodeServer.fail(new Error("OpenCode server exited unexpectedly (1)"));

  await vi.waitFor(() => expect(triggerShutdown.count()).toBe(2));
  expect(logger.fatal).toHaveBeenCalledOnce();
  expect(logger.fatal).toHaveBeenCalledWith(
    "OpenKitten server crashed abnormally, restarting…",
    expect.any(Error),
  );

  triggerShutdown("SIGTERM");
  await run;
});

test("restarts on unexpected grammY event stream end", async () => {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockOpencodeServer();
  mockMcpServer();
  mockExistingSessions();
  mockTypingIndicators();
  mockPendingPrompts();
  mockOpencodeEventStream();
  const grammyEventStream = mockGrammyEventStream();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(grammyEventStream.count()).toBe(1));

  grammyEventStream.end();

  await vi.waitFor(() => expect(grammyEventStream.count()).toBe(2));
  expect(logger.fatal).toHaveBeenCalledOnce();
  expect(logger.fatal).toHaveBeenCalledWith(
    "OpenKitten server stopped unexpectedly, restarting…",
  );

  triggerShutdown("SIGTERM");
  await run;
});

test("restarts on event stream failure", async () => {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockOpencodeServer();
  mockMcpServer();
  mockExistingSessions();
  mockTypingIndicators();
  mockPendingPrompts();
  mockProcessingMessages();
  const stream = mockOpencodeEventStream();
  mockGrammyEventStream();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.count()).toBe(1));

  stream.rejectEnded(new Error("event stream failed"));

  await vi.waitFor(() => expect(triggerShutdown.count()).toBe(2));
  expect(logger.fatal).toHaveBeenCalledOnce();
  expect(logger.fatal).toHaveBeenCalledWith(
    "OpenKitten server crashed abnormally, restarting…",
    expect.any(Error),
  );

  triggerShutdown("SIGTERM");
  await run;
});

test("restarts on grammY event loop failure", async () => {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockOpencodeServer();
  mockMcpServer();
  mockExistingSessions();
  mockTypingIndicators();
  mockPendingPrompts();
  mockProcessingMessages();
  mockOpencodeEventStream();
  const grammyEventLoop = mockGrammyEventLoop();
  const grammyEventStream = mockGrammyEventStream();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(grammyEventLoop.count()).toBe(1));

  grammyEventLoop.rejectEnded(new Error("grammY event loop failed"));

  await vi.waitFor(() => expect(triggerShutdown.count()).toBe(2));
  expect(logger.fatal).toHaveBeenCalledOnce();
  expect(logger.fatal).toHaveBeenCalledWith(
    "OpenKitten server crashed abnormally, restarting…",
    expect.any(Error),
  );

  triggerShutdown("SIGTERM");
  await run;
  expect(grammyEventStream.dispose).toHaveBeenCalledTimes(2);
  expect(grammyEventLoop.dispose).toHaveBeenCalledTimes(2);
});

test("restarts when MCP server exits unexpectedly", async () => {
  mockTelegramConfig();
  mockOpencodeConfig();
  mockCreateDatabase();
  mockOpencodeServer();
  const mcpServer = mockMcpServer();
  mockExistingSessions();
  mockTypingIndicators();
  mockPendingPrompts();
  mockProcessingMessages();
  mockOpencodeEventStream();
  mockGrammyEventStream();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(mcpServer.count()).toBe(1));

  mcpServer.exit();

  await vi.waitFor(() => expect(mcpServer.count()).toBe(2));
  expect(logger.fatal).toHaveBeenCalledOnce();
  expect(logger.fatal).toHaveBeenCalledWith(
    "OpenKitten server stopped unexpectedly, restarting…",
  );

  triggerShutdown("SIGTERM");
  await run;
  expect(mcpServer.dispose).toHaveBeenCalledTimes(2);
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
  mockGrammyEventStream();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });

  await Bun.sleep(0);
  expect(WorkingSessions.create).not.toHaveBeenCalled();

  resolve();
  await vi.waitFor(() => expect(WorkingSessions.create).toHaveBeenCalledOnce());

  triggerShutdown("SIGTERM");
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
  mockGrammyEventStream();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });

  await Bun.sleep(0);
  expect(OpencodeEventStream.create).not.toHaveBeenCalled();

  resolve();
  await vi.waitFor(() => expect(OpencodeEventStream.create).toHaveBeenCalled());

  triggerShutdown("SIGTERM");
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
  mockGrammyEventStream();
  const triggerShutdown = mockShutdown();

  const run = runCommand(serve, { rawArgs: [] });
  await vi.waitFor(() => expect(stream.onEvent()).toBeDefined());

  const signal = new AbortController().signal;
  const result = stream.onEvent()(
    { directory: "/tmp/a", payload: { type: "any-event" } } as never,
    signal,
  );
  await expect(result).resolves.toBeUndefined();

  triggerShutdown("SIGTERM");
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
  mockGrammyEventStream();
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

  triggerShutdown("SIGTERM");
  await run;
});

test("passes skipActions option when yes flag is set", async () => {
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

  triggerShutdown("SIGTERM");
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
  mockGrammyEventStream();
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

  triggerShutdown("SIGTERM");
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
  mockGrammyEventStream();
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

  triggerShutdown("SIGTERM");
  await run;
});
