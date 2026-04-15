import { beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyDownloadContextFiles } from "~/lib/grammy-download-context-files";
import { grammyHandleGroupText } from "~/lib/grammy-handle-group-text";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { GroupMessageBuffer } from "~/lib/group-message-buffer";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

vi.mock("~/lib/get-session-agent");
vi.mock("~/lib/grammy-send-session-pending");
vi.mock("~/lib/grammy-download-context-files");

const signal = new AbortController().signal;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(grammyDownloadContextFiles).mockResolvedValue([]);
});

function mockCtx(options: {
  chatId?: number;
  text?: string;
  threadId?: number;
  messageId?: number;
  from?: { id?: number; first_name?: string; username?: string };
  entities?: { type: string; offset: number; length: number }[];
  replyToMessage?: {
    from?: { id: number };
    text?: string;
  };
}) {
  const {
    chatId = 42,
    text = "hello",
    threadId,
    messageId = 100,
    from = { id: 1, first_name: "Alice" },
    entities,
    replyToMessage,
  } = options;
  return {
    chat: { id: chatId },
    msg: { message_thread_id: threadId },
    message: {
      text,
      message_id: messageId,
      entities,
      reply_to_message: replyToMessage,
    },
    from,
  } as never;
}

function mockOpencodeClient() {
  return {
    session: {
      create: vi.fn(),
      delete: vi.fn(),
      promptAsync: vi.fn().mockResolvedValue({}),
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
    protect: vi.fn(),
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
  groupMessageBuffer?: GroupMessageBuffer;
}): Scope {
  return {
    bot: {
      botInfo: { username: "test_bot", id: 100, first_name: "TestBot" },
    } as never,
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
    groupMessageBuffer: (overrides.groupMessageBuffer ??
      GroupMessageBuffer.create()) as never,
    ownerId: 123 as never,
  };
}

test("context-only message buffers and returns without AI call", async () => {
  const opencodeClient = mockOpencodeClient();
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ opencodeClient, groupMessageBuffer });

  // No mention, no reply to bot → context trigger
  await grammyHandleGroupText(
    scope,
    mockCtx({ chatId: 42, text: "just chatting" }),
    signal,
  );

  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
  // Message was buffered
  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent).toHaveLength(1);
  expect(recent[0]?.text).toBe("just chatting");
});

test("mention trigger formats group prompt and calls promptAsync", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    opencodeClient,
    pendingPrompts,
    groupMessageBuffer,
  });

  await grammyHandleGroupText(
    scope,
    mockCtx({
      text: "@test_bot help me",
      entities: [{ type: "mention", offset: 0, length: 9 }],
    }),
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionID: "s1",
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "text" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("reply trigger includes quotedText in prompt", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    opencodeClient,
    pendingPrompts,
    groupMessageBuffer,
  });

  await grammyHandleGroupText(
    scope,
    mockCtx({
      text: "thanks",
      replyToMessage: { from: { id: 100 }, text: "original bot reply" },
    }),
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionID: "s1",
      parts: expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("original bot reply"),
        }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("locked session sends session pending message", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  const workingSessions = mockWorkingSessions();
  workingSessions.lock.mockRejectedValue(new WorkingSessions.LockedError("s1"));
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    opencodeClient,
    pendingPrompts,
    workingSessions,
    groupMessageBuffer,
  });

  await grammyHandleGroupText(
    scope,
    mockCtx({
      text: "@test_bot help",
      entities: [{ type: "mention", offset: 0, length: 9 }],
    }),
    signal,
  );

  expect(grammySendSessionPending).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 100,
  });
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("pending prompt answer path returns early", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockResolvedValue(undefined);
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    opencodeClient,
    pendingPrompts,
    groupMessageBuffer,
  });

  await grammyHandleGroupText(
    scope,
    mockCtx({
      text: "@test_bot my answer",
      entities: [{ type: "mention", offset: 0, length: 9 }],
    }),
    signal,
  );

  expect(pendingPrompts.answer).toHaveBeenCalled();
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("rethrows non-PendingPrompts.NotFoundError", async () => {
  const pendingPrompts = mockPendingPrompts();
  const error = new Error("unexpected");
  pendingPrompts.answer.mockRejectedValue(error);
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ pendingPrompts, groupMessageBuffer });

  await expect(
    grammyHandleGroupText(
      scope,
      mockCtx({
        text: "@test_bot test",
        entities: [{ type: "mention", offset: 0, length: 9 }],
      }),
      signal,
    ),
  ).rejects.toBe(error);
});

test("rethrows non-WorkingSessions.LockedError from lock", async () => {
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  const workingSessions = mockWorkingSessions();
  const error = new Error("unexpected");
  workingSessions.lock.mockRejectedValue(error);
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    pendingPrompts,
    workingSessions,
    groupMessageBuffer,
  });

  await expect(
    grammyHandleGroupText(
      scope,
      mockCtx({
        text: "@test_bot test",
        entities: [{ type: "mention", offset: 0, length: 9 }],
      }),
      signal,
    ),
  ).rejects.toBe(error);
});

test("passes agent to promptAsync when set", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  vi.mocked(getSessionAgent).mockReturnValue("build");
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    opencodeClient,
    pendingPrompts,
    groupMessageBuffer,
  });

  await grammyHandleGroupText(
    scope,
    mockCtx({
      text: "@test_bot build it",
      entities: [{ type: "mention", offset: 0, length: 9 }],
    }),
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionID: "s1",
      agent: "build",
    }),
    { throwOnError: true },
  );
});

test("uses first_name for senderName", async () => {
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ groupMessageBuffer });

  await grammyHandleGroupText(
    scope,
    mockCtx({ from: { id: 1, first_name: "Bob" } }),
    signal,
  );

  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent[0]?.fromName).toBe("Bob");
});

test("falls back to username when first_name is absent", async () => {
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ groupMessageBuffer });

  await grammyHandleGroupText(
    scope,
    mockCtx({ from: { id: 1, username: "bob_user" } as never }),
    signal,
  );

  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent[0]?.fromName).toBe("bob_user");
});

test("falls back to User when no name info", async () => {
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ groupMessageBuffer });

  await grammyHandleGroupText(
    scope,
    mockCtx({ from: { id: 1 } as never }),
    signal,
  );

  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent[0]?.fromName).toBe("User");
});

test("passes threadId through the flow", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
    groupMessageBuffer,
  });

  await grammyHandleGroupText(
    scope,
    mockCtx({
      text: "@test_bot hello",
      threadId: 7,
      entities: [{ type: "mention", offset: 0, length: 9 }],
    }),
    signal,
  );

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: 7 },
    { createIfNotFound: true },
  );
});

test("buffers message before checking trigger", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.answer.mockRejectedValue(new PendingPrompts.NotFoundError());
  const groupMessageBuffer = GroupMessageBuffer.create();

  // Pre-populate buffer with context
  groupMessageBuffer.add(
    { chatId: 42, threadId: undefined },
    {
      fromName: "Other",
      fromId: 2,
      text: "context message",
      messageId: 99,
      timestamp: Date.now(),
      isBot: false,
    },
  );

  const scope = mockScope({
    opencodeClient,
    pendingPrompts,
    groupMessageBuffer,
  });

  await grammyHandleGroupText(
    scope,
    mockCtx({
      text: "@test_bot help",
      entities: [{ type: "mention", offset: 0, length: 9 }],
    }),
    signal,
  );

  // The prompt should include context from the pre-existing message
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("context message"),
        }),
      ]),
    }),
    { throwOnError: true },
  );
});
