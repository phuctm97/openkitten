import { expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammyHandleAbort } from "~/lib/grammy-handle-abort";
import type { Scope } from "~/lib/scope";

function mockCtx(chatId: number, threadId?: number) {
  const react = vi.fn(async () => true);
  return {
    ctx: {
      chat: { id: chatId },
      msg: { message_thread_id: threadId },
      update: { update_id: 1 },
      react,
    } as never,
    react,
  };
}

function mockExistingSessions(): ExistingSessions {
  return {
    sessionIds: ["s1"],
    find: vi.fn(() => "s1"),
    findOrCreate: vi.fn(async () => "s1"),
    invalidate: vi.fn(),
    check: vi.fn(() => true),
    resolve: vi.fn(() => ({ chatId: 42, threadId: undefined })),
  } as never;
}

function mockOpencodeClient() {
  return {
    session: {
      abort: vi.fn(async () => ({ data: undefined })),
    },
  };
}

function mockScope(overrides: {
  existingSessions: ExistingSessions;
  opencodeClient: ReturnType<typeof mockOpencodeClient>;
}): Scope {
  return {
    shutdown: {} as never,
    bot: {} as never,
    database: {} as never,
    opencodeClient: overrides.opencodeClient as never,
    floatingPromises: {} as never,
    existingSessions: overrides.existingSessions,
    nestingSessions: {} as never,
    workingSessions: {} as never,
    pendingPrompts: {} as never,
    processingMessages: {} as never,
    typingIndicators: {} as never,
  };
}

test("aborts session and reacts with like", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx, react } = mockCtx(42);

  await grammyHandleAbort(scope, ctx);

  expect(existingSessions.findOrCreate).toHaveBeenCalledWith({
    chatId: 42,
    threadId: undefined,
  });
  expect(opencodeClient.session.abort).toHaveBeenCalledWith(
    { sessionID: "s1" },
    { throwOnError: true },
  );
  expect(react).toHaveBeenCalledWith("👍");
});

test("passes threadId when present", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, 7);

  await grammyHandleAbort(scope, ctx);

  expect(existingSessions.findOrCreate).toHaveBeenCalledWith({
    chatId: 42,
    threadId: 7,
  });
});
