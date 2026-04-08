import { beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyHandleFile } from "~/lib/grammy-handle-file";
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
  mimeType?: string | undefined;
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
  mimeType,
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
    getFile: vi.fn<
      () => Promise<{ file_id: string; file_path: string | undefined }>
    >(async () => ({ file_id: "test-file-id", file_path: filePath })),
    update: { update_id: 1 },
  };
}

function buildFilePayload(
  fileType: FileType,
  mimeType: string | undefined,
  fileName: string,
): Record<string, unknown> {
  switch (fileType) {
    case "document":
      return {
        document: {
          file_id: "doc-id",
          ...(mimeType && { mime_type: mimeType }),
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

function mockOpencodeClient(
  input: {
    image?: boolean;
    pdf?: boolean;
    audio?: boolean;
    video?: boolean;
  } = {},
) {
  return {
    session: { create: vi.fn(), delete: vi.fn(), promptAsync: vi.fn() },
    config: {
      get: vi.fn(async () => ({
        data: { model: "anthropic/claude-sonnet-4-6" },
      })),
      providers: vi.fn(async () => ({
        data: {
          providers: [
            {
              id: "anthropic",
              models: {
                "anthropic/claude-sonnet-4-6": {
                  id: "claude-sonnet-4-6",
                  capabilities: {
                    input: {
                      image: input.image ?? true,
                      pdf: input.pdf ?? true,
                      audio: input.audio ?? true,
                      video: input.video ?? true,
                      text: true,
                    },
                  },
                },
              },
            },
          ],
          default: { anthropic: "anthropic/claude-sonnet-4-6" },
        },
      })),
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
    commandRegistry: {} as never,
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
        expect.objectContaining({ type: "file", filename: "test-file-id.oga" }),
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
          filename: "test-file-id.webp",
        }),
      ]),
    }),
    { throwOnError: true },
  );
});

// ─── model-supported MIME: sends base64 + saves to disk ─────────────────────

test("model-supported MIME sends base64 data URL without saving to disk", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
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
      ],
    },
    { throwOnError: true },
  );
  expect(attachmentStorage.write).not.toHaveBeenCalled();
});

// ─── model-unsupported MIME: saves to disk only ──────────────────────────────

test("model-unsupported MIME saves to disk only without base64 file part", async () => {
  const opencodeClient = mockOpencodeClient({
    image: false,
    pdf: false,
    audio: false,
    video: false,
  });
  opencodeClient.session.promptAsync.mockResolvedValue({});
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
    "test-file-id",
    "archive.zip",
    "application/zip",
    new Uint8Array([1, 2, 3]),
  );
});

// ─── caption handling ────────────────────────────────────────────────────────

test("with caption: includes caption text part before file parts", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
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
      ],
    }),
    { throwOnError: true },
  );
});

test("without caption: no leading text part", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
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
  ]);
});

test("media group: deferred download without caption excludes text part", async () => {
  const mediaGroupBuffer = mockMediaGroupBuffer();
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
  ctx.getFile.mockResolvedValue({
    file_id: "test-file-id",
    file_path: undefined,
  });

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
  const opencodeClient = mockOpencodeClient({
    image: false,
    pdf: false,
    audio: false,
    video: false,
  });
  opencodeClient.session.promptAsync.mockResolvedValue({});
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
    "test-file-id",
    "archive.zip",
    "application/zip",
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
  const opencodeClient = mockOpencodeClient({
    image: false,
    pdf: false,
    audio: false,
    video: false,
  });
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "application/x-unknown-noop" },
    }),
  );
  const attachmentStorage = mockAttachmentStorage("/mock/file.bin");
  const scope = mockScope({ opencodeClient, attachmentStorage });

  const ctx = {
    chat: { id: 42 },
    msg: { message_thread_id: undefined },
    message: { message_id: 100, contact: { phone_number: "123" } },
    api: { token: "test-token" },
    getFile: vi.fn(async () => ({
      file_id: "test-file-id",
      file_path: "files/unknown",
    })),
    update: { update_id: 1 },
  };

  await grammyHandleFile(scope, ctx as never, signal);

  expect(attachmentStorage.write).toHaveBeenCalledWith(
    "test-file-id",
    "test-file-id.bin",
    "application/x-unknown-noop",
    new Uint8Array([1, 2, 3]),
  );
});

test("extractTelegramMime: returns image/jpeg for photo messages", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
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
        expect.objectContaining({ type: "file", mime: "image/jpeg" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("resolveMime: falls back to application/octet-stream when no mime info available", async () => {
  const opencodeClient = mockOpencodeClient({
    image: false,
    pdf: false,
    audio: false,
    video: false,
  });
  opencodeClient.session.promptAsync.mockResolvedValue({});
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
  // mime should fall back to application/octet-stream → modelSupportsFile returns false → no file part
  const call = vi.mocked(opencodeClient.session.promptAsync).mock.calls[0];
  if (!call) throw new Error("Expected promptAsync to be called");
  const parts = call[0].parts;
  expect(parts).not.toContainEqual(expect.objectContaining({ type: "file" }));
});

// ─── modelSupportsFile edge cases (inlined) ─────────────────────────────────────

test("modelSupportsFile: returns false when no model and no defaults", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const opencodeClient = {
    session: { create: vi.fn(), delete: vi.fn(), promptAsync: vi.fn() },
    config: {
      get: vi.fn(async () => ({ data: { model: undefined } })),
      providers: vi.fn(async () => ({
        data: { providers: [], default: {} },
      })),
    },
  };
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const attachmentStorage = mockAttachmentStorage("/mock/unsupported.jpg");
  const scope = mockScope({
    opencodeClient: opencodeClient as never,
    attachmentStorage,
  });

  await grammyHandleFile(
    scope,
    mockFileCtx({ fileType: "photo" }) as never,
    signal,
  );

  expect(attachmentStorage.write).toHaveBeenCalled();
});

test("modelSupportsFile: uses default model when config.model is undefined", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const opencodeClient = {
    session: { create: vi.fn(), delete: vi.fn(), promptAsync: vi.fn() },
    config: {
      get: vi.fn(async () => ({ data: { model: undefined } })),
      providers: vi.fn(async () => ({
        data: {
          providers: [
            {
              id: "anthropic",
              models: {
                "anthropic/claude-sonnet-4-6": {
                  id: "claude-sonnet-4-6",
                  capabilities: {
                    input: {
                      image: true,
                      pdf: true,
                      audio: false,
                      video: false,
                      text: true,
                    },
                  },
                },
              },
            },
          ],
          default: { anthropic: "anthropic/claude-sonnet-4-6" },
        },
      })),
    },
  };
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const scope = mockScope({ opencodeClient: opencodeClient as never });

  await grammyHandleFile(
    scope,
    mockFileCtx({ fileType: "photo" }) as never,
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

test("modelSupportsFile: model not found returns false", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const opencodeClient = {
    session: { create: vi.fn(), delete: vi.fn(), promptAsync: vi.fn() },
    config: {
      get: vi.fn(async () => ({ data: { model: "unknown/model" } })),
      providers: vi.fn(async () => ({
        data: { providers: [], default: {} },
      })),
    },
  };
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const attachmentStorage = mockAttachmentStorage("/mock/path.jpg");
  const scope = mockScope({
    opencodeClient: opencodeClient as never,
    attachmentStorage,
  });

  await grammyHandleFile(
    scope,
    mockFileCtx({ fileType: "photo" }) as never,
    signal,
  );

  expect(attachmentStorage.write).toHaveBeenCalled();
});

test("modelSupportsFile: matches model by short name", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const opencodeClient = {
    session: { create: vi.fn(), delete: vi.fn(), promptAsync: vi.fn() },
    config: {
      get: vi.fn(async () => ({
        data: { model: "anthropic/claude-sonnet-4-6" },
      })),
      providers: vi.fn(async () => ({
        data: {
          providers: [
            {
              id: "anthropic",
              models: {
                "claude-sonnet-4-6": {
                  id: "claude-sonnet-4-6",
                  capabilities: {
                    input: {
                      image: true,
                      pdf: false,
                      audio: true,
                      video: false,
                      text: true,
                    },
                  },
                },
              },
            },
          ],
          default: {},
        },
      })),
    },
  };
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const scope = mockScope({ opencodeClient: opencodeClient as never });

  await grammyHandleFile(
    scope,
    mockFileCtx({ fileType: "photo" }) as never,
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

test("modelSupportsFile: pdf routed correctly", async () => {
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
      fileName: "doc.pdf",
    }) as never,
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

test("modelSupportsFile: audio routed to model when supported", async () => {
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

test("resolveMime: falls back to file path lookup when no telegram mime and no header", async () => {
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
      filePath: "files/test.png",
    }) as never,
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

test("resolveMime: falls back to octet-stream when nothing matches", async () => {
  const opencodeClient = mockOpencodeClient({
    image: false,
    pdf: false,
    audio: false,
    video: false,
  });
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const attachmentStorage = mockAttachmentStorage("/mock/file.bin");
  const scope = mockScope({ opencodeClient, attachmentStorage });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "document",

      filePath: "files/noext",
    }) as never,
    signal,
  );

  expect(attachmentStorage.write).toHaveBeenCalled();
});

test("resolveMime: catches invalid content-type header", async () => {
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "invalid" },
    }),
  );
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "document",

      filePath: "files/test.jpg",
    }) as never,
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

test("modelSupportsFile: video saved to disk when not supported", async () => {
  const opencodeClient = mockOpencodeClient({ video: false });
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const attachmentStorage = mockAttachmentStorage("/mock/video.mp4");
  const scope = mockScope({ opencodeClient, attachmentStorage });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "video",
      mimeType: "video/mp4",
      fileName: "clip.mp4",
    }) as never,
    signal,
  );

  expect(attachmentStorage.write).toHaveBeenCalled();
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: "Attached file saved to: /mock/video.mp4",
        }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("modelSupportsFile: matches model by model.id field", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const opencodeClient = {
    session: { create: vi.fn(), delete: vi.fn(), promptAsync: vi.fn() },
    config: {
      get: vi.fn(async () => ({
        data: { model: "anthropic/claude-sonnet-4-6" },
      })),
      providers: vi.fn(async () => ({
        data: {
          providers: [
            {
              id: "anthropic",
              models: {
                "some-internal-key": {
                  id: "anthropic/claude-sonnet-4-6",
                  capabilities: {
                    input: {
                      image: true,
                      pdf: true,
                      audio: false,
                      video: false,
                      text: true,
                    },
                  },
                },
              },
            },
          ],
          default: {},
        },
      })),
    },
  };
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const scope = mockScope({ opencodeClient: opencodeClient as never });

  await grammyHandleFile(
    scope,
    mockFileCtx({ fileType: "photo" }) as never,
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

test("modelSupportsFile: skips non-matching model.id and continues search", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const opencodeClient = {
    session: { create: vi.fn(), delete: vi.fn(), promptAsync: vi.fn() },
    config: {
      get: vi.fn(async () => ({
        data: { model: "anthropic/claude-sonnet-4-6" },
      })),
      providers: vi.fn(async () => ({
        data: {
          providers: [
            {
              id: "anthropic",
              models: {
                "unrelated-key": {
                  id: "unrelated-model",
                  capabilities: {
                    input: {
                      image: false,
                      pdf: false,
                      audio: false,
                      video: false,
                      text: true,
                    },
                  },
                },
                "another-key": {
                  id: "anthropic/claude-sonnet-4-6",
                  capabilities: {
                    input: {
                      image: true,
                      pdf: true,
                      audio: false,
                      video: false,
                      text: true,
                    },
                  },
                },
              },
            },
          ],
          default: {},
        },
      })),
    },
  };
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const scope = mockScope({ opencodeClient: opencodeClient as never });

  await grammyHandleFile(
    scope,
    mockFileCtx({ fileType: "photo" }) as never,
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

test("normalizeMime: strips parameters from MIME type", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const opencodeClient = mockOpencodeClient();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const scope = mockScope({ opencodeClient });

  await grammyHandleFile(
    scope,
    mockFileCtx({
      fileType: "document",
      mimeType: "image/jpeg; charset=binary",
      fileName: "test.jpg",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({
          type: "file",
          mime: "image/jpeg; charset=binary",
        }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("extractTelegramMime: returns undefined for unknown message type", async () => {
  const opencodeClient = mockOpencodeClient({
    image: false,
    pdf: false,
    audio: false,
    video: false,
  });
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "application/octet-stream" },
    }),
  );
  const attachmentStorage = mockAttachmentStorage("/mock/unknown.bin");
  const scope = mockScope({ opencodeClient, attachmentStorage });

  const ctx = {
    chat: { id: 42 },
    msg: { message_thread_id: undefined },
    message: { message_id: 100, contact: { phone_number: "123" } },
    api: { token: "test-token" },
    getFile: vi.fn(async () => ({
      file_id: "test-file-id",
      file_path: "files/unknown",
    })),
    update: { update_id: 1 },
  };

  await grammyHandleFile(scope, ctx as never, signal);

  expect(attachmentStorage.write).toHaveBeenCalled();
});
