import { expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammyHandleCompact } from "~/lib/grammy-handle-compact";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

vi.mock("~/lib/grammy-send-session-pending");

const signal = new AbortController().signal;

function mockCtx(chatId: number, threadId?: number) {
  const react = vi.fn(async () => true);
  return {
    ctx: {
      chat: { id: chatId, type: "private" },
      from: { id: 123 },
      msg: { message_id: 99, message_thread_id: threadId },
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

function mockOpencodeClient() {
  return {
    session: {
      summarize: vi.fn(async () => ({ data: undefined })),
    },
  };
}

function mockWorkingSessions() {
  return {
    sessionIds: [],
    release: vi.fn(),
    invalidate: vi.fn(),
    update: vi.fn(),
    lock: vi.fn((_sessionId: string, fn: () => Promise<void>) => fn()),
  };
}

function mockScope(overrides: {
  existingSessions: ExistingSessions;
  opencodeClient: ReturnType<typeof mockOpencodeClient>;
  workingSessions: ReturnType<typeof mockWorkingSessions>;
}): Scope {
  return {
    bot: {} as never,
    database: {} as never,
    shutdown: {} as never,
    opencodeClient: overrides.opencodeClient as never,
    existingSessions: overrides.existingSessions,
    workingSessions: overrides.workingSessions as never,
    pendingPrompts: {} as never,
    processingMessages: {} as never,
    floatingPromises: {} as never,
    mediaGroupBuffer: {} as never,
    attachmentStorage: {} as never,
    typingIndicators: {} as never,
  };
}

test("summarizes session and reacts with like", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const workingSessions = mockWorkingSessions();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const { ctx, react } = mockCtx(42);

  await grammyHandleCompact(scope, ctx, signal);

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: undefined },
    { createIfNotFound: true },
  );
  expect(opencodeClient.session.summarize).toHaveBeenCalledWith(
    { sessionID: "s1" },
    { throwOnError: true },
  );
  expect(react).toHaveBeenCalledWith("👍");
});

test("locks session before summarizing", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const workingSessions = mockWorkingSessions();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const { ctx } = mockCtx(42);

  await grammyHandleCompact(scope, ctx, signal);

  expect(workingSessions.lock).toHaveBeenCalledWith("s1", expect.any(Function));
});

test("sends pending message when session is locked", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const workingSessions = mockWorkingSessions();
  workingSessions.lock.mockRejectedValue(new WorkingSessions.LockedError("s1"));
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const { ctx } = mockCtx(42);

  await grammyHandleCompact(scope, ctx, signal);

  expect(grammySendSessionPending).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 99,
  });
  expect(opencodeClient.session.summarize).not.toHaveBeenCalled();
});

test("rethrows non-LockedError from lock", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const workingSessions = mockWorkingSessions();
  const error = new Error("unexpected");
  workingSessions.lock.mockRejectedValue(error);
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const { ctx } = mockCtx(42);

  await expect(grammyHandleCompact(scope, ctx, signal)).rejects.toBe(error);
});

test("passes threadId when present", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const workingSessions = mockWorkingSessions();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const { ctx } = mockCtx(42, 7);

  await grammyHandleCompact(scope, ctx, signal);

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: 7 },
    { createIfNotFound: true },
  );
});
