import { expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammyHandleStart } from "~/lib/grammy-handle-start";
import type { Scope } from "~/lib/scope";

function mockCtx(chatId: number, match: string, threadId?: number) {
  const react = vi.fn(async () => true);
  return {
    ctx: {
      chat: { id: chatId },
      msg: { message_thread_id: threadId },
      match,
      update: { update_id: 1 },
      react,
    } as never,
    react,
  };
}

function mockExistingSessions(
  existingSessionId?: string,
): ExistingSessions & { remove: ReturnType<typeof vi.fn> } {
  return {
    sessionIds: existingSessionId ? [existingSessionId] : [],
    find: vi.fn(() => existingSessionId),
    findOrCreate: vi.fn(async () => existingSessionId || "s-new"),
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
    shutdown: {} as never,
    bot: {} as never,
    database: {} as never,
    opencodeClient: overrides.opencodeClient as never,
    floatingPromises: {} as never,
    existingSessions: overrides.existingSessions,
    workingSessions: overrides.workingSessions as never,
    pendingPrompts: {} as never,
    processingMessages: {} as never,
    typingIndicators: {} as never,
  };
}

test("sends 'Hey' when no match text and no existing session", async () => {
  const existingSessions = mockExistingSessions(undefined);
  const opencodeClient = mockOpencodeClient(0);
  const workingSessions = mockWorkingSessions();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const { ctx, react } = mockCtx(42, "");

  await grammyHandleStart(scope, ctx);

  expect(existingSessions.find).toHaveBeenCalledWith({
    chatId: 42,
    threadId: undefined,
  });
  expect(existingSessions.remove).not.toHaveBeenCalled();
  expect(existingSessions.findOrCreate).toHaveBeenCalledWith({
    chatId: 42,
    threadId: undefined,
  });
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    { sessionID: "s-new", parts: [{ type: "text", text: "Hey" }] },
    { throwOnError: true },
  );
  expect(react).toHaveBeenCalledWith("👍");
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
  const { ctx } = mockCtx(42, "Build a website");

  await grammyHandleStart(scope, ctx);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s-new",
      parts: [{ type: "text", text: "Build a website" }],
    },
    { throwOnError: true },
  );
});

test("removes existing session with messages and creates new one", async () => {
  const existingSessions = mockExistingSessions("s-old");
  // After remove, findOrCreate returns a new session
  existingSessions.findOrCreate = vi.fn(async () => "s-new");
  const opencodeClient = mockOpencodeClient(1);
  const workingSessions = mockWorkingSessions();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const { ctx } = mockCtx(42, "");

  await grammyHandleStart(scope, ctx);

  expect(opencodeClient.session.messages).toHaveBeenCalledWith(
    { sessionID: "s-old", limit: 1 },
    { throwOnError: true },
  );
  expect(existingSessions.remove).toHaveBeenCalledWith("s-old");
  expect(existingSessions.findOrCreate).toHaveBeenCalledWith({
    chatId: 42,
    threadId: undefined,
  });
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    { sessionID: "s-new", parts: [{ type: "text", text: "Hey" }] },
    { throwOnError: true },
  );
});

test("keeps existing session with no messages", async () => {
  const existingSessions = mockExistingSessions("s-old");
  const opencodeClient = mockOpencodeClient(0);
  const workingSessions = mockWorkingSessions();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    workingSessions,
  });
  const { ctx } = mockCtx(42, "");

  await grammyHandleStart(scope, ctx);

  expect(existingSessions.remove).not.toHaveBeenCalled();
  expect(existingSessions.findOrCreate).toHaveBeenCalledWith({
    chatId: 42,
    threadId: undefined,
  });
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    { sessionID: "s-old", parts: [{ type: "text", text: "Hey" }] },
    { throwOnError: true },
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
  const { ctx } = mockCtx(42, "", 7);

  await grammyHandleStart(scope, ctx);

  expect(existingSessions.find).toHaveBeenCalledWith({
    chatId: 42,
    threadId: 7,
  });
  expect(existingSessions.findOrCreate).toHaveBeenCalledWith({
    chatId: 42,
    threadId: 7,
  });
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
  const { ctx } = mockCtx(42, "");

  await grammyHandleStart(scope, ctx);

  expect(workingSessions.lock).toHaveBeenCalledWith(
    "s-new",
    expect.any(Function),
  );
});
