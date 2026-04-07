import { extension, lookup } from "mime-types";
import { beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyHandleDocument } from "~/lib/grammy-handle-document";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

const mimeTypesState = vi.hoisted(
  (): {
    actualLookup?: typeof lookup;
    actualExtension?: typeof extension;
  } => ({}),
);

const signal = new AbortController().signal;

vi.mock("mime-types", async () => {
  const actual =
    await vi.importActual<typeof import("mime-types")>("mime-types");
  mimeTypesState.actualLookup = actual.lookup;
  mimeTypesState.actualExtension = actual.extension;
  return {
    ...actual,
    lookup: vi.fn(actual.lookup),
    extension: vi.fn(actual.extension),
  };
});

vi.mock("~/lib/get-session-agent");
vi.mock("~/lib/grammy-send-session-pending");

beforeEach(() => {
  vi.resetAllMocks();
  if (!mimeTypesState.actualLookup) {
    throw new Error("Expected mime-types lookup to be initialized");
  }
  if (!mimeTypesState.actualExtension) {
    throw new Error("Expected mime-types extension to be initialized");
  }
  vi.mocked(lookup).mockImplementation(mimeTypesState.actualLookup);
  vi.mocked(extension).mockImplementation(mimeTypesState.actualExtension);
});

interface MockDocumentCtxOptions {
  filePath?: string | undefined;
  caption?: string;
  threadId?: number;
  messageId?: number;
  fileName?: string;
  mimeType?: string;
  mediaGroupId?: string;
}

function mockDocumentCtx(chatId: number, options: MockDocumentCtxOptions = {}) {
  const {
    filePath = "documents/test.pdf",
    caption,
    threadId,
    messageId = 100,
    fileName,
    mimeType,
    mediaGroupId,
  } = options;

  return {
    chat: { id: chatId },
    msg: { message_thread_id: threadId },
    message: {
      ...(caption !== undefined && { caption }),
      message_id: messageId,
      ...(mediaGroupId !== undefined && { media_group_id: mediaGroupId }),
      document: {
        file_id: "doc-file-id",
        file_unique_id: "doc-unique-id",
        file_size: 1024,
        ...(fileName !== undefined && { file_name: fileName }),
        ...(mimeType !== undefined && { mime_type: mimeType }),
      },
    },
    api: { token: "test-token" },
    getFile: vi.fn<() => Promise<{ file_path: string | undefined }>>(
      async () => ({
        file_path: filePath,
      }),
    ),
    update: { update_id: 1 },
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
    lock: vi.fn((_sessionId: string, fn: () => Promise<void>) => {
      return fn();
    }),
  };
}

function mockMediaGroupBuffer() {
  return {
    add: vi.fn(),
    [Symbol.dispose]: vi.fn(),
  };
}

function mockScope(overrides: {
  existingSessions?: ExistingSessions;
  opencodeClient?: ReturnType<typeof mockOpencodeClient>;
  pendingPrompts?: ReturnType<typeof mockPendingPrompts>;
  workingSessions?: ReturnType<typeof mockWorkingSessions>;
  mediaGroupBuffer?: ReturnType<typeof mockMediaGroupBuffer>;
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
    typingIndicators: {} as never,
  };
}

// --- MIME resolution tests ---

test("uses Telegram mime_type when available", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, {
      mimeType: "application/pdf",
      fileName: "report.pdf",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        {
          type: "file",
          mime: "application/pdf",
          filename: "report.pdf",
          url: expect.stringMatching(/^data:application\/pdf;base64,/),
        },
      ],
    },
    { throwOnError: true },
  );
});

test("falls back to content-type header when no Telegram mime", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "application/zip; charset=binary" },
    }),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, { fileName: "archive.zip" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        {
          type: "file",
          mime: "application/zip",
          filename: "archive.zip",
          url: expect.stringMatching(/^data:application\/zip;base64,/),
        },
      ],
    },
    { throwOnError: true },
  );
});

test("falls back to filename extension lookup when header is invalid", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "not-valid-content-type" },
    }),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, { fileName: "spreadsheet.csv" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        {
          type: "file",
          mime: "text/csv",
          filename: "spreadsheet.csv",
          url: expect.stringMatching(/^data:text\/csv;base64,/),
        },
      ],
    },
    { throwOnError: true },
  );
});

test("falls back to application/octet-stream when nothing works", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  // No mimeType, no fileName, no content-type header — all fallbacks exhausted
  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, { filePath: "documents/file" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        {
          type: "file",
          mime: "application/octet-stream",
          filename: "file",
          url: expect.stringMatching(/^data:application\/octet-stream;base64,/),
        },
      ],
    },
    { throwOnError: true },
  );
});

test("falls back to application/octet-stream when content-type header is invalid and no file name", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "not-valid" },
    }),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  // Invalid header + no fileName → lookup skipped → octet-stream
  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, { filePath: "/" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        {
          type: "file",
          mime: "application/octet-stream",
          filename: "telegram-document.bin",
          url: expect.stringMatching(/^data:application\/octet-stream;base64,/),
        },
      ],
    },
    { throwOnError: true },
  );
});

test("falls back to application/octet-stream when filename extension is unknown", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "not-valid" },
    }),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  // lookup returns false for unknown extension → octet-stream
  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, { fileName: "data.xyz123unknown" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        {
          type: "file",
          mime: "application/octet-stream",
          filename: "data.xyz123unknown",
          url: expect.stringMatching(/^data:application\/octet-stream;base64,/),
        },
      ],
    },
    { throwOnError: true },
  );
});

// --- Filename resolution tests ---

test("uses Telegram file_name when available", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, {
      mimeType: "application/pdf",
      fileName: "my-report.pdf",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ filename: "my-report.pdf" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("falls back to file path basename when no Telegram file name", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, {
      filePath: "documents/server-basename.pdf",
      mimeType: "application/pdf",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ filename: "server-basename.pdf" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("falls back to telegram-document.{ext} with known mime extension", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "application/zip" },
    }),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  // filePath "/" yields empty basename → falls back to telegram-document.{ext}
  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, { filePath: "/" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ filename: "telegram-document.zip" }),
      ]),
    }),
    { throwOnError: true },
  );
});

test("falls back to telegram-document.bin when mime has no known extension", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  // Use a mime type that has no known file extension so extension() returns false
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "application/x-unknown-type-xyz" },
    }),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  // filePath "/" yields empty basename + mime with no extension → .bin
  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, { filePath: "/" }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      parts: expect.arrayContaining([
        expect.objectContaining({ filename: "telegram-document.bin" }),
      ]),
    }),
    { throwOnError: true },
  );
});

// --- Handler flow tests ---

test("prompts opencode with a document attachment", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, {
      mimeType: "application/pdf",
      fileName: "test.pdf",
    }) as never,
    signal,
  );

  expect(pendingPrompts.protect).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 100,
  });
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        {
          type: "file",
          mime: "application/pdf",
          filename: "test.pdf",
          url: "data:application/pdf;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
  expect(fetch).toHaveBeenCalledWith(
    new URL(
      "documents/test.pdf",
      "https://api.telegram.org/file/bottest-token/",
    ),
  );
});

test("document with caption: includes text part", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, {
      caption: "summarize this",
      mimeType: "application/pdf",
      fileName: "test.pdf",
      messageId: 55,
    }) as never,
    signal,
  );

  expect(pendingPrompts.protect).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 55,
  });
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        { type: "text", text: "summarize this" },
        {
          type: "file",
          mime: "application/pdf",
          filename: "test.pdf",
          url: "data:application/pdf;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
});

test("empty caption: no text part", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, {
      caption: "",
      mimeType: "application/pdf",
      fileName: "test.pdf",
      messageId: 55,
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        {
          type: "file",
          mime: "application/pdf",
          filename: "test.pdf",
          url: "data:application/pdf;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
});

test("media group: buffers entry with deferred download", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const mediaGroupBuffer = mockMediaGroupBuffer();
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
    mediaGroupBuffer,
  });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, {
      mimeType: "application/pdf",
      fileName: "test.pdf",
      messageId: 100,
      mediaGroupId: "group-1",
    }) as never,
    signal,
  );

  expect(mediaGroupBuffer.add).toHaveBeenCalledWith("group-1", {
    chatId: 42,
    threadId: undefined,
    messageId: 100,
    download: expect.any(Function),
  });
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
  expect(pendingPrompts.protect).not.toHaveBeenCalled();
});

test("media group: deferred download resolves to correct parts", async () => {
  const mediaGroupBuffer = mockMediaGroupBuffer();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ mediaGroupBuffer });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, {
      mimeType: "application/pdf",
      fileName: "report.pdf",
      mediaGroupId: "group-1",
    }) as never,
    signal,
  );

  const call = vi.mocked(mediaGroupBuffer.add).mock.calls[0];
  if (!call) throw new Error("Expected add to be called");
  const entry = call[1];
  const parts = await entry.download();
  expect(parts).toEqual([
    {
      type: "file",
      mime: "application/pdf",
      filename: "report.pdf",
      url: "data:application/pdf;base64,AQID",
    },
  ]);
});

test("pending prompts protection: returns early if protect succeeds", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockResolvedValue(undefined);
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, { messageId: 77 }) as never,
    signal,
  );

  expect(pendingPrompts.protect).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 77,
  });
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("continues when PendingPrompts.NotFoundError from protect", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockRejectedValue(new PendingPrompts.NotFoundError());
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, { messageId: 77 }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalled();
});

test("rethrows non-NotFoundError from protect", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const error = new Error("unexpected protect error");
  pendingPrompts.protect.mockRejectedValue(error);
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await expect(
    grammyHandleDocument(scope, mockDocumentCtx(42) as never, signal),
  ).rejects.toBe(error);
});

test("locked session: sends session pending message", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const workingSessions = mockWorkingSessions();
  workingSessions.lock.mockRejectedValue(new WorkingSessions.LockedError("s1"));
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
    workingSessions,
  });

  await grammyHandleDocument(scope, mockDocumentCtx(42) as never, signal);

  expect(grammySendSessionPending).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 100,
  });
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("rethrows non-LockedError from lock", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const error = new Error("unexpected lock error");
  const workingSessions = mockWorkingSessions();
  workingSessions.lock.mockRejectedValue(error);
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
    workingSessions,
  });

  await expect(
    grammyHandleDocument(scope, mockDocumentCtx(42) as never, signal),
  ).rejects.toBe(error);
});

test("creates new session when none exists", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleDocument(scope, mockDocumentCtx(42) as never, signal);

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: undefined },
    { createIfNotFound: true },
  );
  expect(pendingPrompts.protect).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 100,
  });
});

test("passes agent to promptAsync when set", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  vi.mocked(getSessionAgent).mockReturnValue("build");
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, {
      mimeType: "application/pdf",
      fileName: "test.pdf",
    }) as never,
    signal,
  );

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      agent: "build",
      parts: [
        {
          type: "file",
          mime: "application/pdf",
          filename: "test.pdf",
          url: "data:application/pdf;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
});

test("passes threadId through the flow", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await grammyHandleDocument(
    scope,
    mockDocumentCtx(42, {
      caption: "caption",
      threadId: 7,
      mimeType: "application/pdf",
      fileName: "test.pdf",
    }) as never,
    signal,
  );

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: 7 },
    { createIfNotFound: true },
  );
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        { type: "text", text: "caption" },
        {
          type: "file",
          mime: "application/pdf",
          filename: "test.pdf",
          url: "data:application/pdf;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
});

test("throws when document has no file path", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const ctx = mockDocumentCtx(42);
  ctx.getFile.mockResolvedValue({ file_path: undefined });
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await expect(
    grammyHandleDocument(scope, ctx as never, signal),
  ).rejects.toThrow("Expected Telegram document to have a file path");
});

test("throws when download fails", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("nope", { status: 500 }),
  );
  const scope = mockScope({ existingSessions, opencodeClient, pendingPrompts });

  await expect(
    grammyHandleDocument(scope, mockDocumentCtx(42) as never, signal),
  ).rejects.toThrow("Expected Telegram document download to succeed");
});
