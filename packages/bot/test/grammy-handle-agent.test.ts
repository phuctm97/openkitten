import { beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyHandleAgent } from "~/lib/grammy-handle-agent";
import { grammySendAgentChanged } from "~/lib/grammy-send-agent-changed";
import { grammySendAgentNotFound } from "~/lib/grammy-send-agent-not-found";
import type { Scope } from "~/lib/scope";
import { setSessionAgent } from "~/lib/set-session-agent";

vi.mock("~/lib/get-session-agent");
vi.mock("~/lib/grammy-send-agent-changed");
vi.mock("~/lib/grammy-send-agent-not-found");
vi.mock("~/lib/set-session-agent");

const signal = new AbortController().signal;

beforeEach(() => {
  vi.resetAllMocks();
});

function mockCtx(chatId: number, match: string, threadId?: number) {
  const react = vi.fn(async () => true);
  return {
    ctx: {
      chat: { id: chatId },
      msg: { message_id: 99, message_thread_id: threadId },
      match,
      update: { update_id: 1 },
      react,
    } as never,
    react,
  };
}

function mockExistingSessions(): ExistingSessions {
  return {
    sessionIds: ["s1"],
    find: vi.fn(
      (
        _location: ExistingSessions.Location,
        options?: ExistingSessions.FindOptions,
      ) => {
        if (options?.createIfNotFound) return Promise.resolve("s1");
        return "s1";
      },
    ),
    invalidate: vi.fn(),
    check: vi.fn(() => true),
    get: vi.fn((_sessionId: string, _options: ExistingSessions.GetOptions) => ({
      chatId: 42,
      threadId: undefined,
    })),
  } as never;
}

const agents = [
  { name: "assist", mode: "primary", description: "General purpose" },
  { name: "build", mode: "all", description: "Software engineering" },
  { name: "plan", mode: "primary" },
  { name: "summary", mode: "primary", hidden: true, description: "Internal" },
  { name: "sub-task", mode: "subagent", description: "Internal" },
];

function mockOpencodeClient(defaultAgent?: string) {
  return {
    app: {
      agents: vi.fn(async () => ({ data: agents })),
    },
    config: {
      get: vi.fn(async () => ({
        data: { default_agent: defaultAgent },
      })),
    },
  };
}

function mockBot() {
  return { api: { sendMessage: vi.fn() } };
}

function mockScope(overrides: {
  bot?: ReturnType<typeof mockBot>;
  existingSessions?: ExistingSessions;
  opencodeClient?: ReturnType<typeof mockOpencodeClient>;
}): Scope {
  return {
    bot: (overrides.bot ?? mockBot()) as never,
    database: {} as never,
    shutdown: {} as never,
    opencodeClient: (overrides.opencodeClient ?? mockOpencodeClient()) as never,
    existingSessions: overrides.existingSessions ?? mockExistingSessions(),
    workingSessions: {} as never,
    pendingPrompts: {} as never,
    processingMessages: {} as never,
    floatingPromises: {} as never,
    mediaGroupBuffer: {} as never,
    typingIndicators: {} as never,
  };
}

test("sends agent list with inline keyboard when no argument", async () => {
  const bot = mockBot();
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  vi.mocked(getSessionAgent).mockReturnValue("build");
  const scope = mockScope({ bot, existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "");

  await grammyHandleAgent(scope, ctx, signal);

  expect(bot.api.sendMessage).toHaveBeenCalledOnce();
  const call = bot.api.sendMessage.mock.calls[0];
  if (!call) throw new Error("Expected sendMessage to be called");
  expect(call[0]).toBe(42);
  expect(call[2]).toEqual(
    expect.objectContaining({
      parse_mode: "MarkdownV2",
      reply_parameters: { message_id: 99 },
      reply_markup: expect.objectContaining({
        inline_keyboard: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: "assist",
              callback_data: "ag:assist",
            }),
            expect.objectContaining({
              text: "✓ build",
              callback_data: "ag:build",
            }),
            expect.objectContaining({ text: "plan", callback_data: "ag:plan" }),
          ]),
        ]),
      }),
    }),
  );
});

test("shows configured default agent when none is set", async () => {
  const bot = mockBot();
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient("assist");
  vi.mocked(getSessionAgent).mockReturnValue(undefined);
  const scope = mockScope({ bot, existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "");

  await grammyHandleAgent(scope, ctx, signal);

  const call = bot.api.sendMessage.mock.calls[0];
  if (!call) throw new Error("Expected sendMessage to be called");
  expect(call[2]).toEqual(
    expect.objectContaining({
      reply_markup: expect.objectContaining({
        inline_keyboard: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ text: "✓ assist" }),
          ]),
        ]),
      }),
    }),
  );
});

test("falls back to build when default_agent is not configured", async () => {
  const bot = mockBot();
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  vi.mocked(getSessionAgent).mockReturnValue(undefined);
  const scope = mockScope({ bot, existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "");

  await grammyHandleAgent(scope, ctx, signal);

  const call = bot.api.sendMessage.mock.calls[0];
  if (!call) throw new Error("Expected sendMessage to be called");
  expect(call[2]).toEqual(
    expect.objectContaining({
      reply_markup: expect.objectContaining({
        inline_keyboard: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ text: "✓ build" }),
          ]),
        ]),
      }),
    }),
  );
});

test("sets valid agent and replies with agent changed", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "build");

  await grammyHandleAgent(scope, ctx, signal);

  expect(setSessionAgent).toHaveBeenCalledWith(scope.database, "s1", "build");
  expect(grammySendAgentChanged).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 99,
    agent: agents[1],
  });
});

test("replies with not found for unknown agent", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "nonexistent");

  await grammyHandleAgent(scope, ctx, signal);

  expect(setSessionAgent).not.toHaveBeenCalled();
  expect(grammySendAgentNotFound).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 99,
    name: "nonexistent",
  });
});

test("rejects subagent", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "sub-task");

  await grammyHandleAgent(scope, ctx, signal);

  expect(setSessionAgent).not.toHaveBeenCalled();
  expect(grammySendAgentNotFound).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 99,
    name: "sub-task",
  });
});

test("rejects hidden primary agent", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "summary");

  await grammyHandleAgent(scope, ctx, signal);

  expect(setSessionAgent).not.toHaveBeenCalled();
  expect(grammySendAgentNotFound).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 99,
    name: "summary",
  });
});

test("passes threadId when present for direct switch", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "build", 7);

  await grammyHandleAgent(scope, ctx, signal);

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: 7 },
    { createIfNotFound: true },
  );
  expect(grammySendAgentChanged).toHaveBeenCalledWith(
    expect.objectContaining({ threadId: 7 }),
  );
});

test("passes threadId in inline keyboard message", async () => {
  const bot = mockBot();
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  vi.mocked(getSessionAgent).mockReturnValue("assist");
  const scope = mockScope({ bot, existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, "", 7);

  await grammyHandleAgent(scope, ctx, signal);

  expect(bot.api.sendMessage).toHaveBeenCalledWith(
    42,
    expect.any(String),
    expect.objectContaining({ message_thread_id: 7 }),
  );
});
