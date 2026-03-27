import { expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammyHandleAbort } from "~/lib/grammy-handle-abort";
import type { Scope } from "~/lib/scope";

function mockCtx(chatId: number, threadId?: number) {
  return {
    chat: { id: chatId },
    msg: { message_thread_id: threadId },
    update: { update_id: 1 },
  } as never;
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
    workingSessions: {} as never,
    pendingPrompts: {} as never,
    processingMessages: {} as never,
    typingIndicators: {} as never,
  };
}

test("aborts session", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });

  await grammyHandleAbort(scope, mockCtx(42));

  expect(existingSessions.findOrCreate).toHaveBeenCalledWith({
    chatId: 42,
    threadId: undefined,
  });
  expect(opencodeClient.session.abort).toHaveBeenCalledWith({
    sessionID: "s1",
  });
});

test("passes threadId when present", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });

  await grammyHandleAbort(scope, mockCtx(42, 7));

  expect(existingSessions.findOrCreate).toHaveBeenCalledWith({
    chatId: 42,
    threadId: 7,
  });
});
