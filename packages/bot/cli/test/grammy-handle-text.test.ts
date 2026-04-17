import { beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import * as groupTextModule from "~/lib/grammy-handle-group-text";
import { grammyHandleText } from "~/lib/grammy-handle-text";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

vi.mock("~/lib/get-session-agent");
vi.mock("~/lib/grammy-send-session-pending");

const signal = new AbortController().signal;

beforeEach(() => {
  vi.resetAllMocks();
});

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
    api: { token: "test-token" },
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

function mockScope(overrides: {
  existingSessions?: ExistingSessions;
  opencodeClient?: ReturnType<typeof mockOpencodeClient>;
  pendingPrompts?: ReturnType<typeof mockPendingPrompts>;
  workingSessions?: ReturnType<typeof mockWorkingSessions>;
}): Scope {
  return {
    bot: { botInfo: { username: "test_bot", id: 100 } } as never,
    database: {} as never,
    shutdown: {} as never,
    opencodeClient: (overrides.opencodeClient ?? mockOpencodeClient()) as never,
    existingSessions: overrides.existingSessions ?? mockExistingSessions(),
    workingSessions: (overrides.workingSessions ??
      mockWorkingSessions()) as never,
    pendingPrompts: (overrides.pendingPrompts ?? mockPendingPrompts()) as never,
    processingMessages: {} as never,
    floatingPromises: {} as never,
    mediaGroupBuffer: {} as never,
    attachmentStorage: {} as never,
    typingIndicators: {} as never,
    groupMessageBuffer: undefined as never,
    ownerId: 123 as never,
  };
}

test("answers pending prompt when session has one", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockResolvedValue(undefined);
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandleText(
    scope,
    mockCtx(42, "my answer", undefined, 55),
    signal,
  );

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
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandleText(scope, mockCtx(42, "hello"), signal);

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
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandleText(scope, mockCtx(42, "hello"), signal);

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: undefined },
    { createIfNotFound: true },
  );
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    { sessionID: "s1", parts: [{ type: "text", text: "hello" }] },
    { throwOnError: true },
  );
});

test("passes agent to promptAsync when set", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.mocked(getSessionAgent).mockReturnValue("build");
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleText(scope, mockCtx(42, "hello"), signal);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      agent: "build",
      parts: [{ type: "text", text: "hello" }],
    },
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
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
    workingSessions,
  });

  await grammyHandleText(scope, mockCtx(42, "hello"), signal);

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
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandleText(scope, mockCtx(42, "hello", 7), signal);

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: 7 },
    { createIfNotFound: true },
  );
  expect(pendingPrompts.answer).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 100,
    text: "hello",
  });
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    { sessionID: "s1", parts: [{ type: "text", text: "hello" }] },
    { throwOnError: true },
  );
});

test("rethrows non-PendingPrompts.NotFoundError from answer", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const error = new Error("unexpected");
  pendingPrompts.answer.mockRejectedValue(error);
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await expect(
    grammyHandleText(scope, mockCtx(42, "hello"), signal),
  ).rejects.toBe(error);
});

test("rethrows errors from lock", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  const error = new Error("unexpected");
  const workingSessions = mockWorkingSessions();
  workingSessions.lock.mockRejectedValue(error);
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
    workingSessions,
  });

  await expect(
    grammyHandleText(scope, mockCtx(42, "hello"), signal),
  ).rejects.toBe(error);
});

test("forwards slash commands as regular text to opencode", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const scope = mockScope({ opencodeClient, pendingPrompts });

  await grammyHandleText(scope, mockCtx(42, "/translate hello"), signal);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: [{ type: "text", text: "/translate hello" }],
    }),
    { throwOnError: true },
  );
});

test("delegates to group handler in group mode", async () => {
  const groupSpy = vi
    .spyOn(groupTextModule, "grammyHandleGroupText")
    .mockResolvedValue();
  const scope = mockScope({});
  // Enable group mode by setting groupMessageBuffer
  const groupScope = {
    ...scope,
    groupMessageBuffer: {} as never,
  };
  const ctx = {
    chat: { id: 42, type: "supergroup" },
    msg: { message_thread_id: undefined },
    message: { text: "hello", message_id: 100 },
    update: { update_id: 1 },
  } as never;

  await grammyHandleText(groupScope, ctx, signal);

  expect(groupSpy).toHaveBeenCalledOnce();
});

test("prepends reply context when replying to a message", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const scope = mockScope({ opencodeClient, pendingPrompts });

  const ctx = {
    chat: { id: 42 },
    msg: { message_thread_id: undefined },
    message: {
      text: "my reply",
      message_id: 100,
      reply_to_message: {
        text: "original message",
        from: { first_name: "Alice" },
      },
    },
    update: { update_id: 1 },
  } as never;

  await grammyHandleText(scope, ctx, signal);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: [
        {
          type: "text",
          text: expect.stringMatching(/^\[Replying to Alice.*\n\nmy reply$/),
        },
      ],
    }),
    { throwOnError: true },
  );
});

test("does not delegate in group chat when groupMessageBuffer is undefined", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const scope = mockScope({ opencodeClient, pendingPrompts });
  const ctx = {
    chat: { id: 42, type: "supergroup" },
    msg: { message_thread_id: undefined },
    message: { text: "hello", message_id: 100 },
    update: { update_id: 1 },
  } as never;

  await grammyHandleText(scope, ctx, signal);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalled();
});
