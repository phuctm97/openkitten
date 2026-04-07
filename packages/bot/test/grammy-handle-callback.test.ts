import { beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammyHandleCallback } from "~/lib/grammy-handle-callback";
import type { Scope } from "~/lib/scope";
import { setSessionAgent } from "~/lib/set-session-agent";

vi.mock("~/lib/set-session-agent");

const signal = new AbortController().signal;

beforeEach(() => {
  vi.resetAllMocks();
});

function mockCtx(
  chatId: number,
  callbackQueryId: string,
  data: string,
  threadId?: number,
  messageId = 50,
) {
  return {
    callbackQuery: {
      id: callbackQueryId,
      data,
      message: {
        chat: { id: chatId },
        message_id: messageId,
        message_thread_id: threadId,
      },
    },
    update: { update_id: 1 },
  } as never;
}

function mockBot() {
  return {
    api: {
      answerCallbackQuery: vi.fn(),
      editMessageText: vi.fn(),
    },
  };
}

function mockExistingSessions(sessionId: string | undefined): ExistingSessions {
  return {
    sessionIds: sessionId ? [sessionId] : [],
    find: vi.fn(() => sessionId),
    invalidate: vi.fn(),
    check: vi.fn(() => !!sessionId),
    get: vi.fn((_sessionId: string, _options: ExistingSessions.GetOptions) => ({
      chatId: 42,
      threadId: undefined,
    })),
  } as never;
}

function mockPendingPrompts() {
  return {
    sessionIds: [],
    invalidate: vi.fn(),
    update: vi.fn(),
    answer: vi.fn(),
    dismiss: vi.fn(),
    [Symbol.asyncDispose]: vi.fn(),
  };
}

function mockOpencodeClient(agents = defaultAgents) {
  return {
    app: {
      agents: vi.fn(async () => ({ data: agents })),
    },
  };
}

const defaultAgents = [
  { name: "assist", mode: "primary", description: "General purpose" },
  { name: "build", mode: "all", description: "Software engineering" },
  {
    name: "hidden-agent",
    mode: "primary",
    hidden: true,
    description: "Internal",
  },
  { name: "sub-task", mode: "subagent", description: "Internal" },
];

function mockScope(overrides: {
  bot?: ReturnType<typeof mockBot>;
  existingSessions?: ExistingSessions;
  pendingPrompts?: ReturnType<typeof mockPendingPrompts>;
  opencodeClient?: ReturnType<typeof mockOpencodeClient>;
}): Scope {
  return {
    bot: (overrides.bot ?? mockBot()) as never,
    database: {} as never,
    shutdown: {} as never,
    opencodeClient: (overrides.opencodeClient ?? mockOpencodeClient()) as never,
    existingSessions: overrides.existingSessions ?? mockExistingSessions("s1"),
    workingSessions: {} as never,
    pendingPrompts: (overrides.pendingPrompts ?? mockPendingPrompts()) as never,
    processingMessages: {} as never,
    floatingPromises: {} as never,
    mediaGroupBuffer: {} as never,
    typingIndicators: {} as never,
  };
}

test("resolves session and forwards callback to pending prompts", async () => {
  const bot = mockBot();
  const existingSessions = mockExistingSessions("s1");
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockResolvedValue(undefined);
  const scope = mockScope({ bot, existingSessions, pendingPrompts });

  await grammyHandleCallback(scope, mockCtx(42, "cb1", "po:0"), signal);

  expect(existingSessions.find).toHaveBeenCalledWith({
    chatId: 42,
    threadId: undefined,
  });
  expect(pendingPrompts.answer).toHaveBeenCalledWith({
    sessionId: "s1",
    callbackQueryId: "cb1",
    callbackQueryData: "po:0",
  });
});

test("passes threadId when present", async () => {
  const bot = mockBot();
  const existingSessions = mockExistingSessions("s1");
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockResolvedValue(undefined);
  const scope = mockScope({ bot, existingSessions, pendingPrompts });

  await grammyHandleCallback(scope, mockCtx(42, "cb2", "pa:1", 7), signal);

  expect(existingSessions.find).toHaveBeenCalledWith({
    chatId: 42,
    threadId: 7,
  });
  expect(pendingPrompts.answer).toHaveBeenCalledWith({
    sessionId: "s1",
    callbackQueryId: "cb2",
    callbackQueryData: "pa:1",
  });
});

test("answers with expired_session when no session exists", async () => {
  const bot = mockBot();
  const existingSessions = mockExistingSessions(undefined);
  const pendingPrompts = mockPendingPrompts();
  const scope = mockScope({ bot, existingSessions, pendingPrompts });

  await grammyHandleCallback(scope, mockCtx(42, "cb1", "po:0"), signal);

  expect(bot.api.answerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred: expired_session",
  });
  expect(pendingPrompts.answer).not.toHaveBeenCalled();
});

test("throws invariant error when message is missing", async () => {
  const scope = mockScope({});

  const ctx = {
    callbackQuery: {
      id: "cb1",
      data: "po:0",
      message: undefined,
    },
    update: { update_id: 1 },
  } as never;

  await expect(grammyHandleCallback(scope, ctx, signal)).rejects.toThrow(
    "Expected callback query to have a message",
  );
});

test("rethrows errors from pending prompts", async () => {
  const pendingPrompts = mockPendingPrompts();
  const error = new Error("unexpected");
  pendingPrompts.answer.mockRejectedValue(error);
  const scope = mockScope({ pendingPrompts });

  await expect(
    grammyHandleCallback(scope, mockCtx(42, "cb1", "po:0"), signal),
  ).rejects.toBe(error);
});

// --- Agent callback tests ---

test("agent callback switches agent and edits message", async () => {
  const bot = mockBot();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ bot, opencodeClient });

  await grammyHandleCallback(scope, mockCtx(42, "cb1", "ag:build"), signal);

  expect(setSessionAgent).toHaveBeenCalledWith(scope.database, "s1", "build");
  expect(bot.api.editMessageText).toHaveBeenCalledWith(
    42,
    50,
    expect.any(String),
    expect.objectContaining({
      parse_mode: "MarkdownV2",
      reply_markup: { inline_keyboard: [] },
    }),
  );
  expect(bot.api.answerCallbackQuery).toHaveBeenCalledWith("cb1");
});

test("agent callback answers expired when no session exists", async () => {
  const bot = mockBot();
  const existingSessions = mockExistingSessions(undefined);
  const scope = mockScope({ bot, existingSessions });

  await grammyHandleCallback(scope, mockCtx(42, "cb1", "ag:build"), signal);

  expect(bot.api.answerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "Session expired",
  });
  expect(setSessionAgent).not.toHaveBeenCalled();
});

test("agent callback answers not available for unknown agent", async () => {
  const bot = mockBot();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ bot, opencodeClient });

  await grammyHandleCallback(
    scope,
    mockCtx(42, "cb1", "ag:nonexistent"),
    signal,
  );

  expect(bot.api.answerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: 'Agent "nonexistent" is not available',
  });
  expect(setSessionAgent).not.toHaveBeenCalled();
});

test("agent callback rejects hidden agent", async () => {
  const bot = mockBot();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ bot, opencodeClient });

  await grammyHandleCallback(
    scope,
    mockCtx(42, "cb1", "ag:hidden-agent"),
    signal,
  );

  expect(bot.api.answerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: 'Agent "hidden-agent" is not available',
  });
  expect(setSessionAgent).not.toHaveBeenCalled();
});

test("agent callback rejects subagent", async () => {
  const bot = mockBot();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ bot, opencodeClient });

  await grammyHandleCallback(scope, mockCtx(42, "cb1", "ag:sub-task"), signal);

  expect(bot.api.answerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: 'Agent "sub-task" is not available',
  });
  expect(setSessionAgent).not.toHaveBeenCalled();
});

test("agent callback throws invariant when message is missing", async () => {
  const scope = mockScope({});

  const ctx = {
    callbackQuery: {
      id: "cb1",
      data: "ag:build",
      message: undefined,
    },
    update: { update_id: 1 },
  } as never;

  await expect(grammyHandleCallback(scope, ctx, signal)).rejects.toThrow(
    "Expected callback query to have a message",
  );
});
