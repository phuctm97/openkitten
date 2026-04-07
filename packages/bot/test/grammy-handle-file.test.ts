import { beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyHandleFile } from "~/lib/grammy-handle-file";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { supportsInput } from "~/lib/model-capabilities";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

vi.mock("~/lib/get-session-agent");
vi.mock("~/lib/grammy-send-session-pending");
vi.mock("~/lib/model-capabilities");

const signal = new AbortController().signal;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(supportsInput).mockResolvedValue(true);
});

// ─── context builders ────────────────────────────────────────────────────────

type FileType =
  | "document"
  | "video"
  | "audio"
  | "voice"
  | "animation"
  | "video_note"
  | "sticker"
  | "photo";

interface MockFileCtxOptions {
  chatId?: number;
  caption?: string | undefined;
  threadId?: number | undefined;
  messageId?: number;
  filePath?: string | undefined;
  mediaGroupId?: string;
  fileType?: FileType;
  mimeType?: string;
  fileName?: string;
}

function mockFileCtx({
  chatId = 42,
  caption,
  threadId,
  messageId = 100,
  filePath = "files/test.jpg",
  mediaGroupId,
  fileType = "document",
  mimeType = "image/jpeg",
  fileName = "test.jpg",
}: MockFileCtxOptions = {}) {
  const filePayload = buildFilePayload(fileType, mimeType, fileName);
  return {
    chat: { id: chatId },
    msg: { message_thread_id: threadId },
    message: {
      ...(caption !== undefined && { caption }),
      message_id: messageId,
      ...filePayload,
      media_group_id: mediaGroupId,
    },
    api: { token: "test-token" },
    getFile: vi.fn<() => Promise<{ file_path: string | undefined }>>(
      async () => ({ file_path: filePath }),
    ),
    update: { update_id: 1 },
  };
}

function buildFilePayload(
  fileType: FileType,
  mimeType: string,
  fileName: string,
): Record<string, unknown> {
  switch (fileType) {
    case "document":
      return {
        document: {
          file_id: "doc-id",
          mime_type: mimeType,
          file_name: fileName,
        },
      };
    case "video":
      return {
        video: { file_id: "vid-id", mime_type: mimeType, file_name: fileName },
      };
    case "audio":
      return {
        audio: { file_id: "aud-id", mime_type: mimeType, file_name: fileName },
      };
    case "voice":
      return { voice: { file_id: "voi-id", mime_type: mimeType } };
    case "animation":
      return {
        animation: {
          file_id: "ani-id",
          mime_type: mimeType,
          file_name: fileName,
        },
      };
    case "video_note":
      return { video_note: { file_id: "vn-id" } };
    case "sticker":
      return { sticker: { file_id: "stk-id" } };
    case "photo":
      return {
        photo: [{ file_id: "photo-small" }, { file_id: "photo-large" }],
      };
  }
}

// ─── scope helpers ───────────────────────────────────────────────────────────

function mockMediaGroupBuffer() {
  return {
    add: vi.fn(),
    [Symbol.dispose]: vi.fn(),
  };
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
    check: vi.fn(() => false),
    protect: vi.fn<() => Promise<void>>(async () => {
      throw new PendingPrompts.NotFoundError();
    }),
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
    lock: vi.fn((_sessionId: string, fn: () => Promise<void>) => fn()),
  };
}

function mockAttachmentStorage(savedPath = "/mock/path/file.jpg") {
  return {
    write: vi.fn(async () => savedPath),
  };
}

function mockScope(overrides: {
  existingSessions?: ExistingSessions;
  opencodeClient?: ReturnType<typeof mockOpencodeClient>;
  pendingPrompts?: ReturnType<typeof mockPendingPrompts>;
  workingSessions?: ReturnType<typeof mockWorkingSessions>;
  mediaGroupBuffer?: ReturnType<typeof mockMediaGroupBuffer>;
  attachmentStorage?: ReturnType<typeof mockAttachmentStorage>;
}): Scope {
  return {
    bot: {} as never,
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
    attachmentStorage: (overrides.attachmentStorage ??
      mockAttachmentStorage()) as never,
    typingIndicators: {} as never,
  };
}

// ─── extractTelegramMime ─────────────────────────────────────────────────────

test("extractTelegramMime: document returns document mime_type", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({ fileType: "document", mimeType: "application/pdf" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", mime: "application/pdf" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("extractTelegramMime: video returns video mime_type", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "video",
      mimeType: "video/mp4",
      filePath: "files/test.mp4",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", mime: "video/mp4" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("extractTelegramMime: audio returns audio mime_type", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "audio",
      mimeType: "audio/mpeg",
      filePath: "files/test.mp3",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", mime: "audio/mpeg" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("extractTelegramMime: voice returns voice mime_type", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "voice",
      mimeType: "audio/ogg",
      filePath: "files/test.ogg",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", mime: "audio/ogg" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("extractTelegramMime: animation returns animation mime_type", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "animation",
      mimeType: "video/mp4",
      filePath: "files/test.mp4",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", mime: "video/mp4" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("extractTelegramMime: video_note always returns video/mp4", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "video_note",
      filePath: "files/test.mp4",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", mime: "video/mp4" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("extractTelegramMime: sticker always returns image/webp", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({ fileType: "sticker", filePath: "files/test.webp" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", mime: "image/webp" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("extractTelegramMime: photo has no telegram mime, falls back to content-type header", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "image/jpeg" },
    }),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({ fileType: "photo", filePath: "photos/test.jpg" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", mime: "image/jpeg" }),
      ]),
    }),
    { throwOnError: true },
  );
});

// ─── extractTelegramFilename ─────────────────────────────────────────────────

test("extractTelegramFilename: document uses file_name from metadata", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "document",
      mimeType: "application/pdf",
      fileName: "my-report.pdf",
      filePath: "files/somehash",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", filename: "my-report.pdf" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("extractTelegramFilename: video uses file_name from metadata", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "video",
      mimeType: "video/mp4",
      fileName: "clip.mp4",
      filePath: "files/somehash",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", filename: "clip.mp4" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("extractTelegramFilename: audio uses file_name from metadata", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "audio",
      mimeType: "audio/mpeg",
      fileName: "song.mp3",
      filePath: "files/somehash",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", filename: "song.mp3" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("extractTelegramFilename: animation uses file_name from metadata", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "animation",
      mimeType: "video/mp4",
      fileName: "anim.mp4",
      filePath: "files/somehash",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", filename: "anim.mp4" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("extractTelegramFilename: voice falls back to file path segment", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "voice",
      mimeType: "audio/ogg",
      filePath: "files/voice-hash.ogg",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", filename: "voice-hash.ogg" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("extractTelegramFilename: sticker falls back to fallback prefix with extension", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({ fileType: "sticker", filePath: "/" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({
          type: "file",
          filename: "telegram-file.webp",
        }),
      ]),
    }),
    { throwOnError: true },
  );
});

// ─── model-supported MIME: sends base64 + saves to disk ─────────────────────

test("model-supported MIME sends base64 data URL and saves to disk", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.mocked(supportsInput).mockResolvedValue(true);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const attachmentStorage = mockAttachmentStorage("/mock/path/file.jpg");
  const scope = mockScope({ opencodeClient, attachmentStorage });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "document",
      mimeType: "image/jpeg",
      fileName: "test.jpg",
      filePath: "files/test.jpg",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        {
          type: "file",
          mime: "image/jpeg",
          filename: "test.jpg",
          url: "data:image/jpeg;base64,AQID",
        },
        {
          type: "text",
          text: "Attached file saved to: /mock/path/file.jpg",
        },
      ],
    },
    { throwOnError: true },
  );
  expect(attachmentStorage.write).toHaveBeenCalledWith(
    "test.jpg",
    new Uint8Array([1, 2, 3]),
  );
});

// ─── model-unsupported MIME: saves to disk only ──────────────────────────────

test("model-unsupported MIME saves to disk only without base64 file part", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.mocked(supportsInput).mockResolvedValue(false);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const attachmentStorage = mockAttachmentStorage("/mock/path/archive.zip");
  const scope = mockScope({ opencodeClient, attachmentStorage });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "document",
      mimeType: "application/zip",
      fileName: "archive.zip",
      filePath: "files/archive.zip",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        {
          type: "text",
          text: "Attached file saved to: /mock/path/archive.zip",
        },
      ],
    },
    { throwOnError: true },
  );
  expect(attachmentStorage.write).toHaveBeenCalledWith(
    "archive.zip",
    new Uint8Array([1, 2, 3]),
  );
});

// ─── caption handling ────────────────────────────────────────────────────────

test("with caption: includes caption text part before file parts", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.mocked(supportsInput).mockResolvedValue(true);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({ caption: "what is this?" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: [
        { type: "text", text: "what is this?" },
        expect.objectContaining({ type: "file" }),
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("Attached file saved to:"),
        }),
      ],
    }),
    { throwOnError: true },
  );
});

test("without caption: no leading text part", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.mocked(supportsInput).mockResolvedValue(true);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({ caption: undefined }) as never,
    signal,
  );

  const call = vi.mocked(opencodeClient.session.promptAsync).mock.calls[0];
  if (!call) throw new Error("Expected promptAsync to be called");
  const parts = call[0].parts;
  expect(parts[0]).toMatchObject({ type: "file" });
});

test("empty caption: does not include empty text part", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.mocked(supportsInput).mockResolvedValue(true);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(scope, mockFileCtx({ caption: "" }) as never, signal);

  const call = vi.mocked(opencodeClient.session.promptAsync).mock.calls[0];
  if (!call) throw new Error("Expected promptAsync to be called");
  const parts = call[0].parts;
  expect(parts[0]).toMatchObject({ type: "file" });
});

// ─── media group ────────────────────────────────────────────────────────────

test("media group: buffers entry with deferred download and returns early", async () => {
  const mediaGroupBuffer = mockMediaGroupBuffer();
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const scope = mockScope({
    mediaGroupBuffer,
    existingSessions,
    opencodeClient,
  });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      chatId: 42,
      threadId: 7,
      messageId: 100,
      mediaGroupId: "mg1",
    }) as never,
    signal,
  );

  expect(mediaGroupBuffer.add).toHaveBeenCalledWith("mg1", {
    chatId: 42,
    threadId: 7,
    messageId: 100,
    download: expect.any(Function),
  });
  expect(existingSessions.find).not.toHaveBeenCalled();
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("media group: deferred download resolves to correct parts with caption", async () => {
  const mediaGroupBuffer = mockMediaGroupBuffer();
  vi.mocked(supportsInput).mockResolvedValue(true);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const attachmentStorage = mockAttachmentStorage("/mock/path/file.jpg");
  const scope = mockScope({ mediaGroupBuffer, attachmentStorage });

  await grammyHandleFile(
    scope,
    mockFileCtx({ caption: "look at this", mediaGroupId: "mg1" }) as never,
    signal,
  );

  const call = vi.mocked(mediaGroupBuffer.add).mock.calls[0];
  if (!call) throw new Error("Expected add to be called");
  const parts = await call[1].download();
  expect(parts).toEqual([
    { type: "text", text: "look at this" },
    {
      type: "file",
      mime: "image/jpeg",
      filename: "test.jpg",
      url: "data:image/jpeg;base64,AQID",
    },
    { type: "text", text: "Attached file saved to: /mock/path/file.jpg" },
  ]);
});

test("media group: deferred download without caption excludes text part", async () => {
  const mediaGroupBuffer = mockMediaGroupBuffer();
  vi.mocked(supportsInput).mockResolvedValue(true);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const attachmentStorage = mockAttachmentStorage("/mock/path/file.jpg");
  const scope = mockScope({ mediaGroupBuffer, attachmentStorage });

  await grammyHandleFile(
    scope,
    mockFileCtx({ mediaGroupId: "mg2" }) as never,
    signal,
  );

  const call = vi.mocked(mediaGroupBuffer.add).mock.calls[0];
  if (!call) throw new Error("Expected add to be called");
  const parts = await call[1].download();
  expect(parts[0]).toMatchObject({ type: "file" });
  expect(parts).not.toContainEqual(
    expect.objectContaining({ text: expect.stringMatching(/look|caption/i) }),
  );
});

// ─── pending prompts ─────────────────────────────────────────────────────────

test("pending prompts: protect succeeds → returns early without prompting", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockResolvedValue(undefined);
  const scope = mockScope({ opencodeClient, pendingPrompts });

  await grammyHandleFile(
    scope,
    mockFileCtx({ messageId: 77 }) as never,
    signal,
  );

  expect(pendingPrompts.protect).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 77,
  });
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("pending prompts: NotFoundError from protect → continues to prompt", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockRejectedValue(new PendingPrompts.NotFoundError());
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient, pendingPrompts });

  await grammyHandleFile(scope, mockFileCtx() as never, signal);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalled();
});

test("pending prompts: rethrows non-NotFoundError from protect", async () => {
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const error = new Error("unexpected protect error");
  pendingPrompts.protect.mockRejectedValue(error);
  const scope = mockScope({ opencodeClient, pendingPrompts });

  await expect(
    grammyHandleFile(scope, mockFileCtx() as never, signal),
  ).rejects.toBe(error);
});

// ─── session locking ─────────────────────────────────────────────────────────

test("LockedError: sends pending message when session is locked", async () => {
  const opencodeClient = mockOpencodeClient();
  const workingSessions = mockWorkingSessions();
  workingSessions.lock.mockRejectedValue(new WorkingSessions.LockedError("s1"));
  const scope = mockScope({ opencodeClient, workingSessions });

  await grammyHandleFile(
    scope,
    mockFileCtx({ chatId: 42, threadId: undefined, messageId: 100 }) as never,
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

test("LockedError: sends pending message with threadId", async () => {
  const opencodeClient = mockOpencodeClient();
  const workingSessions = mockWorkingSessions();
  workingSessions.lock.mockRejectedValue(new WorkingSessions.LockedError("s1"));
  const scope = mockScope({ opencodeClient, workingSessions });

  await grammyHandleFile(
    scope,
    mockFileCtx({ chatId: 42, threadId: 5, messageId: 200 }) as never,
    signal,
  );

  expect(grammySendSessionPending).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: 5,
    replyToMessageId: 200,
  });
});

test("rethrows non-LockedError from lock", async () => {
  const opencodeClient = mockOpencodeClient();
  const workingSessions = mockWorkingSessions();
  const error = new Error("unexpected lock error");
  workingSessions.lock.mockRejectedValue(error);
  const scope = mockScope({ opencodeClient, workingSessions });

  await expect(
    grammyHandleFile(scope, mockFileCtx() as never, signal),
  ).rejects.toBe(error);
});

// ─── error paths ─────────────────────────────────────────────────────────────

test("no file path: throws invariant error", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const scope = mockScope({ opencodeClient });

  const ctx = mockFileCtx();
  ctx.getFile.mockResolvedValue({ file_path: undefined });

  await expect(grammyHandleFile(scope, ctx as never, signal)).rejects.toThrow(
    "Expected Telegram file to have a file path",
  );
});

test("download fails: throws invariant error", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("error", { status: 500 }),
  );
  const scope = mockScope({ opencodeClient });

  await expect(
    grammyHandleFile(scope, mockFileCtx() as never, signal),
  ).rejects.toThrow("Expected Telegram file download to succeed");
});

// ─── additional flow tests ───────────────────────────────────────────────────

test("passes agent to promptAsync when session agent is set", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.mocked(getSessionAgent).mockReturnValue("build");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(scope, mockFileCtx() as never, signal);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({ agent: "build" }),
    { throwOnError: true },
  );
});

test("creates new session when none exists for chat", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ existingSessions, opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({ chatId: 99, threadId: undefined }) as never,
    signal,
  );

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 99, threadId: undefined },
    { createIfNotFound: true },
  );
});

test("passes threadId through the full flow", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ existingSessions, opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({ chatId: 42, threadId: 9 }) as never,
    signal,
  );

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: 9 },
    { createIfNotFound: true },
  );
});

test("fetch is called with correct Telegram file URL", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({ filePath: "documents/abc123.pdf" }) as never,
    signal,
  );

  expect(fetchSpy).toHaveBeenCalledWith(
    new URL(
      "documents/abc123.pdf",
      "https://api.telegram.org/file/bottest-token/",
    ),
  );
});

test("attachment storage write is always called even for unsupported MIME", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.mocked(supportsInput).mockResolvedValue(false);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([9, 8, 7])),
  );
  const attachmentStorage = mockAttachmentStorage("/mock/path/archive.zip");
  const scope = mockScope({ opencodeClient, attachmentStorage });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "document",
      mimeType: "application/zip",
      fileName: "archive.zip",
      filePath: "files/archive.zip",
    }) as never,
    signal,
  );

  expect(attachmentStorage.write).toHaveBeenCalledWith(
    "archive.zip",
    new Uint8Array([9, 8, 7]),
  );
});

test("throws invariant when ctx.chat is missing", async () => {
  const scope = mockScope({});
  const ctx = {
    chat: undefined,
    message: { message_id: 1 },
    update: { update_id: 1 },
  };
  await expect(grammyHandleFile(scope, ctx as never, signal)).rejects.toThrow(
    "Expected file message to have a chat",
  );
});

test("throws invariant when ctx.message is missing", async () => {
  const scope = mockScope({});
  const ctx = {
    chat: { id: 42 },
    message: undefined,
    update: { update_id: 1 },
  };
  await expect(grammyHandleFile(scope, ctx as never, signal)).rejects.toThrow(
    "Expected file message to have a message",
  );
});

test("resolveFilename: falls back to bin extension when mime has no known extension", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.mocked(supportsInput).mockResolvedValue(false);
  // Use video_note (mime = video/mp4 hardcoded) but override with a fake mime via content-type header
  // and use filePath "/" so path segment is empty
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "application/x-unknown-noop" },
    }),
  );
  const scope = mockScope({ opencodeClient });

  // Use photo type so telegram mime is undefined, then content-type gives unknown mime
  await grammyHandleFile(
    scope,
    mockFileCtx({ fileType: "photo", filePath: "/" }) as never,
    signal,
  );

  const call = vi.mocked(opencodeClient.session.promptAsync).mock.calls[0];
  if (!call) throw new Error("Expected promptAsync to be called");
  const parts = call[0].parts;
  // filename should be "telegram-file.bin" since extension("application/x-unknown-noop") is false
  expect(parts).toContainEqual(
    expect.objectContaining({
      text: expect.stringContaining("Attached file saved to:"),
    }),
  );
});

test("resolveMime: uses lookup from file path when no telegram mime and no content-type header", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.mocked(supportsInput).mockResolvedValue(true);
  // No telegram mime (photo type), no content-type header, but file path has a known extension
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({ fileType: "photo", filePath: "photos/test.png" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ type: "file", mime: "image/png" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("resolveMime: falls back to application/octet-stream when no mime info available", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.mocked(supportsInput).mockResolvedValue(false);
  // No telegram mime (photo type), no content-type header, no recognisable extension
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({ fileType: "photo", filePath: "photos/noext" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining("Attached file saved to:"),
        }),
      ]),
    }),
    { throwOnError: true },
  );
  // mime should fall back to application/octet-stream → supportsInput returns false → no file part
  const call = vi.mocked(opencodeClient.session.promptAsync).mock.calls[0];
  if (!call) throw new Error("Expected promptAsync to be called");
  const parts = call[0].parts;
  expect(parts).not.toContainEqual(expect.objectContaining({ type: "file" }));
});
