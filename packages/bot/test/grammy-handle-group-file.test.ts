import { beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyDownloadContextFiles } from "~/lib/grammy-download-context-files";
import { fileParts } from "~/lib/grammy-file-parts";
import { grammyHandleGroupFile } from "~/lib/grammy-handle-group-file";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { GroupMessageBuffer } from "~/lib/group-message-buffer";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

vi.mock("~/lib/get-session-agent");
vi.mock("~/lib/grammy-send-session-pending");
vi.mock("~/lib/grammy-file-parts");
vi.mock("~/lib/grammy-download-context-files");

const signal = new AbortController().signal;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fileParts).mockResolvedValue([{ type: "text", text: "a file" }]);
  vi.mocked(grammyDownloadContextFiles).mockResolvedValue([]);
});

function mockCtx(options: {
  chatId?: number;
  threadId?: number;
  messageId?: number;
  from?: { id?: number; first_name?: string; username?: string };
  entities?: { type: string; offset: number; length: number }[];
  replyToMessage?: { from?: { id: number }; text?: string };
  photo?: { file_id: string }[];
  document?: { file_id: string; mime_type?: string; file_name?: string };
  caption?: string;
  captionEntities?: { type: string; offset: number; length: number }[];
  text?: string;
  mediaGroupId?: string;
}) {
  const {
    chatId = 42,
    threadId,
    messageId = 100,
    from = { id: 1, first_name: "Alice" },
    entities,
    replyToMessage,
    photo,
    document = {
      file_id: "f1",
      mime_type: "application/pdf",
      file_name: "doc.pdf",
    },
    caption,
    captionEntities,
    text,
    mediaGroupId,
  } = options;
  return {
    chat: { id: chatId },
    msg: { message_thread_id: threadId },
    message: {
      message_id: messageId,
      entities,
      caption_entities: captionEntities,
      reply_to_message: replyToMessage,
      ...(photo ? { photo } : { document }),
      ...(caption !== undefined && { caption }),
      ...(text !== undefined && { text }),
      media_group_id: mediaGroupId,
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

function mockMediaGroupBuffer() {
  return {
    add: vi.fn(),
  };
}

function mockScope(overrides: {
  existingSessions?: ExistingSessions;
  opencodeClient?: ReturnType<typeof mockOpencodeClient>;
  pendingPrompts?: ReturnType<typeof mockPendingPrompts>;
  workingSessions?: ReturnType<typeof mockWorkingSessions>;
  groupMessageBuffer?: GroupMessageBuffer;
  mediaGroupBuffer?: ReturnType<typeof mockMediaGroupBuffer>;
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
    mediaGroupBuffer: (overrides.mediaGroupBuffer ??
      mockMediaGroupBuffer()) as never,
    attachmentStorage: {} as never,
    typingIndicators: {} as never,
    groupMessageBuffer: (overrides.groupMessageBuffer ??
      GroupMessageBuffer.create()) as never,
    ownerId: 123 as never,
  };
}

test("context-only file buffers description and returns", async () => {
  const opencodeClient = mockOpencodeClient();
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ opencodeClient, groupMessageBuffer });

  await grammyHandleGroupFile(scope, mockCtx({}), signal);

  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent).toHaveLength(1);
  expect(recent[0]?.text).toContain("sent");
});

test("context file stores fileId and fileMime in buffer", async () => {
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ groupMessageBuffer });

  await grammyHandleGroupFile(
    scope,
    mockCtx({
      document: {
        file_id: "doc-123",
        mime_type: "application/pdf",
        file_name: "report.pdf",
      },
    }),
    signal,
  );

  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent).toHaveLength(1);
  expect(recent[0]?.fileId).toBe("doc-123");
  expect(recent[0]?.fileMime).toBe("application/pdf");
});

test("photo buffers with image/jpeg mime", async () => {
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ groupMessageBuffer });

  await grammyHandleGroupFile(
    scope,
    mockCtx({
      photo: [{ file_id: "photo-sm" }, { file_id: "photo-lg" }] as never,
    }),
    signal,
  );

  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent[0]?.fileId).toBe("photo-lg");
  expect(recent[0]?.fileMime).toBe("image/jpeg");
  expect(recent[0]?.text).toContain("photo");
});

test("file with mention trigger processes and calls promptAsync", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockRejectedValue(new PendingPrompts.NotFoundError());
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    opencodeClient,
    pendingPrompts,
    groupMessageBuffer,
  });

  await grammyHandleGroupFile(
    scope,
    mockCtx({
      caption: "@test_bot check this",
      captionEntities: [{ type: "mention", offset: 0, length: 9 }],
    }),
    signal,
  );

  expect(fileParts).toHaveBeenCalled();
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

test("reply trigger processes file with group context", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockRejectedValue(new PendingPrompts.NotFoundError());
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    opencodeClient,
    pendingPrompts,
    groupMessageBuffer,
  });

  await grammyHandleGroupFile(
    scope,
    mockCtx({
      replyToMessage: { from: { id: 100 }, text: "bot said this" },
    }),
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("bot said this"),
        }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("locked session sends session pending message", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockRejectedValue(new PendingPrompts.NotFoundError());
  const workingSessions = mockWorkingSessions();
  workingSessions.lock.mockRejectedValue(new WorkingSessions.LockedError("s1"));
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    opencodeClient,
    pendingPrompts,
    workingSessions,
    groupMessageBuffer,
  });

  await grammyHandleGroupFile(
    scope,
    mockCtx({
      caption: "@test_bot check",
      captionEntities: [{ type: "mention", offset: 0, length: 9 }],
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

test("pending prompt protect path returns early", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockResolvedValue(undefined);
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    opencodeClient,
    pendingPrompts,
    groupMessageBuffer,
  });

  await grammyHandleGroupFile(
    scope,
    mockCtx({
      caption: "@test_bot answer",
      captionEntities: [{ type: "mention", offset: 0, length: 9 }],
    }),
    signal,
  );

  expect(pendingPrompts.protect).toHaveBeenCalled();
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("media group adds to media group buffer and returns", async () => {
  const opencodeClient = mockOpencodeClient();
  const mediaGroupBuffer = mockMediaGroupBuffer();
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    opencodeClient,
    mediaGroupBuffer,
    groupMessageBuffer,
  });

  await grammyHandleGroupFile(
    scope,
    mockCtx({
      caption: "@test_bot check these",
      captionEntities: [{ type: "mention", offset: 0, length: 9 }],
      mediaGroupId: "mg-1",
    }),
    signal,
  );

  expect(mediaGroupBuffer.add).toHaveBeenCalledWith(
    "mg-1",
    expect.objectContaining({
      chatId: 42,
      messageId: 100,
      download: expect.any(Function),
    }),
  );
  // Execute the download lambda to cover line 128
  const entry = mediaGroupBuffer.add.mock.calls[0]?.[1] as {
    download: () => Promise<unknown>;
  };
  await entry.download();
  expect(vi.mocked(fileParts)).toHaveBeenCalled();
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("rethrows non-PendingPrompts.NotFoundError from protect", async () => {
  const pendingPrompts = mockPendingPrompts();
  const error = new Error("unexpected");
  pendingPrompts.protect.mockRejectedValue(error);
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ pendingPrompts, groupMessageBuffer });

  await expect(
    grammyHandleGroupFile(
      scope,
      mockCtx({
        caption: "@test_bot test",
        captionEntities: [{ type: "mention", offset: 0, length: 9 }],
      }),
      signal,
    ),
  ).rejects.toBe(error);
});

test("rethrows non-WorkingSessions.LockedError from lock", async () => {
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockRejectedValue(new PendingPrompts.NotFoundError());
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
    grammyHandleGroupFile(
      scope,
      mockCtx({
        caption: "@test_bot test",
        captionEntities: [{ type: "mention", offset: 0, length: 9 }],
      }),
      signal,
    ),
  ).rejects.toBe(error);
});

test("passes agent to promptAsync when set", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockRejectedValue(new PendingPrompts.NotFoundError());
  vi.mocked(getSessionAgent).mockReturnValue("build");
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    opencodeClient,
    pendingPrompts,
    groupMessageBuffer,
  });

  await grammyHandleGroupFile(
    scope,
    mockCtx({
      caption: "@test_bot build",
      captionEntities: [{ type: "mention", offset: 0, length: 9 }],
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

  await grammyHandleGroupFile(
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

  await grammyHandleGroupFile(
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

  await grammyHandleGroupFile(
    scope,
    mockCtx({ from: { id: 1 } as never }),
    signal,
  );

  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent[0]?.fromName).toBe("User");
});

test("prepends text part when fileParts has no text part", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockRejectedValue(new PendingPrompts.NotFoundError());
  vi.mocked(fileParts).mockResolvedValue([
    { type: "file", mime: "image/jpeg", filename: "pic.jpg", url: "data:..." },
  ]);
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({
    opencodeClient,
    pendingPrompts,
    groupMessageBuffer,
  });

  await grammyHandleGroupFile(
    scope,
    mockCtx({
      caption: "@test_bot look",
      captionEntities: [{ type: "mention", offset: 0, length: 9 }],
    }),
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "text" }),
        expect.objectContaining({ type: "file" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("describes video file type correctly", async () => {
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ groupMessageBuffer });

  const ctx = {
    chat: { id: 42 },
    msg: { message_thread_id: undefined },
    message: {
      message_id: 100,
      video: { file_id: "v1", mime_type: "video/mp4" },
    },
    from: { id: 1, first_name: "Alice" },
  } as never;

  await grammyHandleGroupFile(scope, ctx, signal);

  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent[0]?.text).toContain("video");
});

test("describes audio file type correctly", async () => {
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ groupMessageBuffer });

  const ctx = {
    chat: { id: 42 },
    msg: { message_thread_id: undefined },
    message: {
      message_id: 100,
      audio: { file_id: "a1", mime_type: "audio/mpeg" },
    },
    from: { id: 1, first_name: "Alice" },
  } as never;

  await grammyHandleGroupFile(scope, ctx, signal);

  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent[0]?.text).toContain("audio");
});

test("describes voice message correctly", async () => {
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ groupMessageBuffer });

  const ctx = {
    chat: { id: 42 },
    msg: { message_thread_id: undefined },
    message: {
      message_id: 100,
      voice: { file_id: "vo1", mime_type: "audio/ogg" },
    },
    from: { id: 1, first_name: "Alice" },
  } as never;

  await grammyHandleGroupFile(scope, ctx, signal);

  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent[0]?.text).toContain("voice");
});

test("describes sticker correctly", async () => {
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ groupMessageBuffer });

  const ctx = {
    chat: { id: 42 },
    msg: { message_thread_id: undefined },
    message: {
      message_id: 100,
      sticker: { file_id: "st1", emoji: "😀" },
    },
    from: { id: 1, first_name: "Alice" },
  } as never;

  await grammyHandleGroupFile(scope, ctx, signal);

  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent[0]?.text).toContain("sticker");
});

test("describes animation (GIF) correctly", async () => {
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ groupMessageBuffer });

  const ctx = {
    chat: { id: 42 },
    msg: { message_thread_id: undefined },
    message: {
      message_id: 100,
      animation: { file_id: "an1", mime_type: "video/mp4" },
    },
    from: { id: 1, first_name: "Alice" },
  } as never;

  await grammyHandleGroupFile(scope, ctx, signal);

  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent[0]?.text).toContain("GIF");
});

test("describes video_note correctly", async () => {
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ groupMessageBuffer });

  const ctx = {
    chat: { id: 42 },
    msg: { message_thread_id: undefined },
    message: {
      message_id: 100,
      video_note: { file_id: "vn1" },
    },
    from: { id: 1, first_name: "Alice" },
  } as never;

  await grammyHandleGroupFile(scope, ctx, signal);

  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent[0]?.text).toContain("video note");
});

test("describes document with filename", async () => {
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ groupMessageBuffer });

  await grammyHandleGroupFile(
    scope,
    mockCtx({
      document: {
        file_id: "d1",
        mime_type: "application/pdf",
        file_name: "report.pdf",
      },
    }),
    signal,
  );

  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent[0]?.text).toContain("report.pdf");
});

test("describes unknown file type as 'sent a file'", async () => {
  const groupMessageBuffer = GroupMessageBuffer.create();
  const scope = mockScope({ groupMessageBuffer });
  // Context with no known media properties
  const ctx = {
    chat: { id: 42, type: "group" },
    msg: { message_thread_id: undefined },
    message: { message_id: 100, entities: [], caption_entities: undefined },
    from: { id: 1, first_name: "Alice" },
  } as never;
  await grammyHandleGroupFile(scope, ctx, signal);
  const recent = groupMessageBuffer.recent({ chatId: 42, threadId: undefined });
  expect(recent[0]?.text).toBe("Alice sent a file");
  expect(recent[0]?.fileId).toBeUndefined();
  expect(recent[0]?.fileMime).toBeUndefined();
});
