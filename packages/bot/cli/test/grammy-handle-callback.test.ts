import { expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammyHandleCallback } from "~/lib/grammy-handle-callback";
import type { Scope } from "~/lib/scope";

const signal = new AbortController().signal;

function mockCtx(
  chatId: number,
  callbackQueryId: string,
  data: string,
  threadId?: number,
) {
  return {
    callbackQuery: {
      id: callbackQueryId,
      data,
      message: {
        chat: { id: chatId },
        message_thread_id: threadId,
      },
    },
    update: { update_id: 1 },
  } as never;
}

function mockBot() {
  return { api: { answerCallbackQuery: vi.fn() } };
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

function mockScope(overrides: {
  bot: ReturnType<typeof mockBot>;
  existingSessions: ExistingSessions;
  pendingPrompts: ReturnType<typeof mockPendingPrompts>;
}): Scope {
  return {
    bot: overrides.bot as never,
    database: {} as never,
    shutdown: {} as never,
    opencodeClient: {} as never,
    existingSessions: overrides.existingSessions,
    workingSessions: {} as never,
    pendingPrompts: overrides.pendingPrompts as never,
    processingMessages: {} as never,
    floatingPromises: {} as never,
    mediaGroupBuffer: {} as never,
    attachmentStorage: {} as never,
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
  const bot = mockBot();
  const existingSessions = mockExistingSessions("s1");
  const pendingPrompts = mockPendingPrompts();
  const scope = mockScope({ bot, existingSessions, pendingPrompts });

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
  const bot = mockBot();
  const existingSessions = mockExistingSessions("s1");
  const pendingPrompts = mockPendingPrompts();
  const error = new Error("unexpected");
  pendingPrompts.answer.mockRejectedValue(error);
  const scope = mockScope({ bot, existingSessions, pendingPrompts });

  await expect(
    grammyHandleCallback(scope, mockCtx(42, "cb1", "po:0"), signal),
  ).rejects.toBe(error);
});
