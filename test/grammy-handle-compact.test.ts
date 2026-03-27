import { expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammyHandleCompact } from "~/lib/grammy-handle-compact";
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
      summarize: vi.fn(async () => ({ data: undefined })),
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

test("summarizes session and reacts with like", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx, react } = mockCtx(42);

  await grammyHandleCompact(scope, ctx);

  expect(existingSessions.findOrCreate).toHaveBeenCalledWith({
    chatId: 42,
    threadId: undefined,
  });
  expect(opencodeClient.session.summarize).toHaveBeenCalledWith({
    sessionID: "s1",
  });
  expect(react).toHaveBeenCalledWith("👍");
});

test("passes threadId when present", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({ existingSessions, opencodeClient });
  const { ctx } = mockCtx(42, 7);

  await grammyHandleCompact(scope, ctx);

  expect(existingSessions.findOrCreate).toHaveBeenCalledWith({
    chatId: 42,
    threadId: 7,
  });
});
