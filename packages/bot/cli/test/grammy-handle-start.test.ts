import { expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyHandleStart } from "~/lib/grammy-handle-start";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

vi.mock("~/lib/get-session-agent");
vi.mock("~/lib/grammy-send-session-pending");

const signal = new AbortController().signal;

function mockCtx(chatId: number, match: string, threadId?: number) {
  return {
    chat: { id: chatId, type: "private" },
    from: { id: 123 },
    msg: { message_id: 99, message_thread_id: threadId },
    match,
    update: { update_id: 1 },
  } as never;
}

function mockExistingSessions(
  existingSessionId?: string,
  createdSessionId = "s-new",
): ExistingSessions & { remove: ReturnType<typeof vi.fn> } {
  return {
    sessionIds: existingSessionId ? [existingSessionId] : [],
    find: vi.fn(
      (
        _location: ExistingSessions.Location,
        options?: ExistingSessions.FindOptions,
      ) => {
        if (options?.createIfNotFound) return Promise.resolve(createdSessionId);
        return existingSessionId;
      },
    ),
    invalidate: vi.fn(),
    check: vi.fn(() => true),
    get: vi.fn((_sessionId: string, _options: ExistingSessions.GetOptions) => ({
      chatId: 42,
      threadId: undefined,
    })),
    remove: vi.fn(async () => undefined),
    hook: vi.fn(),
  } as never;
}

function mockOpencodeClient(messageCount: number) {
  return {
    session: {
      messages: vi.fn(async () => ({
        data: Array.from({ length: messageCount }, (_, i) => ({
          info: { id: `m${i}` },
          parts: [],
        })),
      })),
      promptAsync: vi.fn(async () => ({})),
    },
  };
}

function mockWorkingSessions(working = false) {
  return {
    sessionIds: [],
    release: vi.fn(),
    invalidate: vi.fn(),
    update: vi.fn(),
    check: vi.fn(() => working),
    lock: vi.fn((_sessionId: string, fn: () => Promise<void>) => fn()),
  };
}

function mockPendingPrompts(pending = false) {
  return {
    sessionIds: [],
    invalidate: vi.fn(),
    update: vi.fn(),
    answer: vi.fn(),
    dismiss: vi.fn(),
    check: vi.fn(() => pending),
    [Symbol.asyncDispose]: vi.fn(),
  };
}

function mockScope(overrides: {
  existingSessions: ExistingSessions;
  opencodeClient: ReturnType<typeof mockOpencodeClient>;
  workingSessions: ReturnType<typeof mockWorkingSessions>;
  pendingPrompts?: ReturnType<typeof mockPendingPrompts>;
}): Scope {
  return {
    bot: {} as never,
    database: {} as never,
    shutdown: {} as never,
    opencodeClient: overrides.opencodeClient as never,
    existingSessions: overrides.existingSessions,
    workingSessions: overrides.workingSessions as never,
    pendingPrompts: (overrides.pendingPrompts ?? mockPendingPrompts()) as never,
    processingMessages: {} as never,
    floatingPromises: {} as never,
    mediaGroupBuffer: {} as never,
    attachmentStorage: {} as never,
    typingIndicators: {} as never,
  };
}

test("sends 'Hey' when no match text", async () => {
  const existingSessions = mockExistingSessions(undefined);
  const opencodeClient = mockOpencodeClient(0);
  const workingSessions = mockWorkingSessions();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const ctx = mockCtx(42, "");

  await grammyHandleStart(scope, ctx, signal);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    { sessionID: "s-new", parts: [{ type: "text", text: "Hey" }] },
    { throwOnError: true },
  );
});

test("sends custom text when match is provided", async () => {
  const existingSessions = mockExistingSessions(undefined);
  const opencodeClient = mockOpencodeClient(0);
  const workingSessions = mockWorkingSessions();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const ctx = mockCtx(42, "Build a website");

  await grammyHandleStart(scope, ctx, signal);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s-new",
      parts: [{ type: "text", text: "Build a website" }],
    },
    { throwOnError: true },
  );
});

test("removes existing session with messages", async () => {
  const existingSessions = mockExistingSessions("s-old");
  const opencodeClient = mockOpencodeClient(1);
  const workingSessions = mockWorkingSessions();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const ctx = mockCtx(42, "");

  await grammyHandleStart(scope, ctx, signal);

  expect(opencodeClient.session.messages).toHaveBeenCalledWith(
    { sessionID: "s-old", limit: 1 },
    { throwOnError: true },
  );
  expect(existingSessions.remove).toHaveBeenCalledWith("s-old");
});

test("removes existing working session without checking messages", async () => {
  const existingSessions = mockExistingSessions("s-old");
  const opencodeClient = mockOpencodeClient(0);
  const workingSessions = mockWorkingSessions(true);
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const ctx = mockCtx(42, "");

  await grammyHandleStart(scope, ctx, signal);

  expect(opencodeClient.session.messages).not.toHaveBeenCalled();
  expect(existingSessions.remove).toHaveBeenCalledWith("s-old");
});

test("removes existing session with pending prompt without checking messages", async () => {
  const existingSessions = mockExistingSessions("s-old");
  const opencodeClient = mockOpencodeClient(0);
  const workingSessions = mockWorkingSessions();
  const pendingPrompts = mockPendingPrompts(true);
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
    pendingPrompts,
  });
  const ctx = mockCtx(42, "");

  await grammyHandleStart(scope, ctx, signal);

  expect(opencodeClient.session.messages).not.toHaveBeenCalled();
  expect(existingSessions.remove).toHaveBeenCalledWith("s-old");
});

test("reuses existing empty session", async () => {
  const existingSessions = mockExistingSessions("s-old", "s-old");
  const opencodeClient = mockOpencodeClient(0);
  const workingSessions = mockWorkingSessions();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const ctx = mockCtx(42, "");

  await grammyHandleStart(scope, ctx, signal);

  expect(existingSessions.find).toHaveBeenCalledTimes(1);
  expect(existingSessions.remove).not.toHaveBeenCalled();
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    { sessionID: "s-old", parts: [{ type: "text", text: "Hey" }] },
    { throwOnError: true },
  );
});

test("does not remove when no existing session", async () => {
  const existingSessions = mockExistingSessions(undefined);
  const opencodeClient = mockOpencodeClient(0);
  const workingSessions = mockWorkingSessions();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const ctx = mockCtx(42, "");

  await grammyHandleStart(scope, ctx, signal);

  expect(existingSessions.remove).not.toHaveBeenCalled();
});

test("locks session before sending prompt", async () => {
  const existingSessions = mockExistingSessions(undefined);
  const opencodeClient = mockOpencodeClient(0);
  const workingSessions = mockWorkingSessions();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const ctx = mockCtx(42, "");

  await grammyHandleStart(scope, ctx, signal);

  expect(workingSessions.lock).toHaveBeenCalledWith(
    "s-new",
    expect.any(Function),
  );
});

test("passes threadId through the flow", async () => {
  const existingSessions = mockExistingSessions(undefined);
  const opencodeClient = mockOpencodeClient(0);
  const workingSessions = mockWorkingSessions();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const ctx = mockCtx(42, "", 7);

  await grammyHandleStart(scope, ctx, signal);

  expect(existingSessions.find).toHaveBeenCalledWith({
    chatId: 42,
    threadId: 7,
  });
  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: 7 },
    { createIfNotFound: true },
  );
});

test("sends pending message when session is locked", async () => {
  const existingSessions = mockExistingSessions(undefined);
  const opencodeClient = mockOpencodeClient(0);
  const workingSessions = mockWorkingSessions();
  workingSessions.lock.mockRejectedValue(
    new WorkingSessions.LockedError("s-new"),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const ctx = mockCtx(42, "");

  await grammyHandleStart(scope, ctx, signal);

  expect(grammySendSessionPending).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 99,
  });
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("passes agent to promptAsync when set", async () => {
  const existingSessions = mockExistingSessions(undefined);
  const opencodeClient = mockOpencodeClient(0);
  const workingSessions = mockWorkingSessions();
  vi.mocked(getSessionAgent).mockReturnValue("build");
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const ctx = mockCtx(42, "");

  await grammyHandleStart(scope, ctx, signal);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s-new",
      agent: "build",
      parts: [{ type: "text", text: "Hey" }],
    },
    { throwOnError: true },
  );
});

test("rethrows non-LockedError from lock", async () => {
  const existingSessions = mockExistingSessions(undefined);
  const opencodeClient = mockOpencodeClient(0);
  const workingSessions = mockWorkingSessions();
  const error = new Error("unexpected");
  workingSessions.lock.mockRejectedValue(error);
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const ctx = mockCtx(42, "");

  await expect(grammyHandleStart(scope, ctx, signal)).rejects.toBe(error);
});
