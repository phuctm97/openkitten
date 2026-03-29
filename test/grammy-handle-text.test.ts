import { expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammyHandleText } from "~/lib/grammy-handle-text";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

vi.mock("~/lib/grammy-send-session-pending");

function mockCtx(
  chatId: number,
  text: string,
  threadId?: number,
  messageId = 100,
) {
  return {
    chat: { id: chatId },
    msg: { message_thread_id: threadId },
    message: { text, message_id: messageId },
    update: { update_id: 1 },
  } as never;
}

function mockOpencodeClient() {
  return {
    session: {
      create: vi.fn(),
      delete: vi.fn(),
      promptAsync: vi.fn(),
    },
  };
}

function mockExistingSessions(sessionId = "s1"): ExistingSessions {
  return {
    sessionIds: [sessionId],
    find: vi.fn(
      (
        _location: ExistingSessions.Location,
        options?: ExistingSessions.FindOptions,
      ) => {
        if (options?.createIfNotFound) return Promise.resolve(sessionId);
        return sessionId;
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

function mockWorkingSessions() {
  return {
    sessionIds: [],
    release: vi.fn(),
    invalidate: vi.fn(),
    update: vi.fn(),
    lock: vi.fn((_sessionId: string, fn: () => Promise<void>) => {
      return fn();
    }),
  };
}

test("answers pending prompt when session has one", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockResolvedValue(undefined);
  const scope = {
    shutdown: {} as never,
    bot: {} as never,
    database: {} as never,
    opencodeClient: opencodeClient as never,
    floatingPromises: {} as never,
    existingSessions,
    workingSessions: mockWorkingSessions() as never,
    pendingPrompts: pendingPrompts as never,
    processingMessages: {} as never,
    typingIndicators: {} as never,
  } satisfies Scope;

  await grammyHandleText(scope, mockCtx(42, "my answer", undefined, 55));

  expect(pendingPrompts.answer).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 55,
    text: "my answer",
  });
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("prompts opencode when no pending prompt", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const scope = {
    shutdown: {} as never,
    bot: {} as never,
    database: {} as never,
    opencodeClient: opencodeClient as never,
    floatingPromises: {} as never,
    existingSessions,
    workingSessions: mockWorkingSessions() as never,
    pendingPrompts: pendingPrompts as never,
    processingMessages: {} as never,
    typingIndicators: {} as never,
  } satisfies Scope;

  await grammyHandleText(scope, mockCtx(42, "hello"));

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    { sessionID: "s1", parts: [{ type: "text", text: "hello" }] },
    { throwOnError: true },
  );
});

test("creates new session when none exists", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const scope = {
    shutdown: {} as never,
    bot: {} as never,
    database: {} as never,
    opencodeClient: opencodeClient as never,
    floatingPromises: {} as never,
    existingSessions,
    workingSessions: mockWorkingSessions() as never,
    pendingPrompts: pendingPrompts as never,
    processingMessages: {} as never,
    typingIndicators: {} as never,
  } satisfies Scope;

  await grammyHandleText(scope, mockCtx(42, "hello"));

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: undefined },
    { createIfNotFound: true },
  );
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    { sessionID: "s1", parts: [{ type: "text", text: "hello" }] },
    { throwOnError: true },
  );
});

test("sends pending message when session is locked", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  const workingSessions = mockWorkingSessions();
  workingSessions.lock.mockRejectedValue(new WorkingSessions.LockedError("s1"));
  const scope = {
    shutdown: {} as never,
    bot: {} as never,
    database: {} as never,
    opencodeClient: opencodeClient as never,
    floatingPromises: {} as never,
    existingSessions,
    workingSessions: workingSessions as never,
    pendingPrompts: pendingPrompts as never,
    processingMessages: {} as never,
    typingIndicators: {} as never,
  } satisfies Scope;

  await grammyHandleText(scope, mockCtx(42, "hello"));

  expect(grammySendSessionPending).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 100,
  });
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("passes threadId through the flow", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const scope = {
    shutdown: {} as never,
    bot: {} as never,
    database: {} as never,
    opencodeClient: opencodeClient as never,
    floatingPromises: {} as never,
    existingSessions,
    workingSessions: mockWorkingSessions() as never,
    pendingPrompts: pendingPrompts as never,
    processingMessages: {} as never,
    typingIndicators: {} as never,
  } satisfies Scope;

  await grammyHandleText(scope, mockCtx(42, "hello", 7));

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: 7 },
    { createIfNotFound: true },
  );
  expect(pendingPrompts.answer).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 100,
    text: "hello",
  });
  expect(opencodeClient.session.promptAsync).toHaveBeenCalled();
});

test("rethrows non-PendingPrompts.NotFoundError from answer", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const error = new Error("unexpected");
  pendingPrompts.answer.mockRejectedValue(error);
  const scope = {
    shutdown: {} as never,
    bot: {} as never,
    database: {} as never,
    opencodeClient: opencodeClient as never,
    floatingPromises: {} as never,
    existingSessions,
    workingSessions: mockWorkingSessions() as never,
    pendingPrompts: pendingPrompts as never,
    processingMessages: {} as never,
    typingIndicators: {} as never,
  } satisfies Scope;

  await expect(grammyHandleText(scope, mockCtx(42, "hello"))).rejects.toBe(
    error,
  );
});

test("rethrows errors from lock", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  const error = new Error("unexpected");
  const workingSessions = mockWorkingSessions();
  workingSessions.lock.mockRejectedValue(error);
  const scope = {
    shutdown: {} as never,
    bot: {} as never,
    database: {} as never,
    opencodeClient: opencodeClient as never,
    floatingPromises: {} as never,
    existingSessions,
    workingSessions: workingSessions as never,
    pendingPrompts: pendingPrompts as never,
    processingMessages: {} as never,
    typingIndicators: {} as never,
  } satisfies Scope;

  await expect(grammyHandleText(scope, mockCtx(42, "hello"))).rejects.toBe(
    error,
  );
});
