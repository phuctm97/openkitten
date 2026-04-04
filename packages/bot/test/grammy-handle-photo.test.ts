import { lookup } from "mime-types";
import { beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyHandlePhoto } from "~/lib/grammy-handle-photo";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

const mimeTypesState = vi.hoisted((): { actualLookup?: typeof lookup } => ({}));

const signal = new AbortController().signal;

vi.mock("mime-types", async () => {
  const actual =
    await vi.importActual<typeof import("mime-types")>("mime-types");
  mimeTypesState.actualLookup = actual.lookup;
  return {
    ...actual,
    lookup: vi.fn(actual.lookup),
  };
});

vi.mock("~/lib/get-session-agent");
vi.mock("~/lib/grammy-send-session-pending");

beforeEach(() => {
  vi.resetAllMocks();
  if (!mimeTypesState.actualLookup) {
    throw new Error("Expected mime-types lookup to be initialized");
  }
  vi.mocked(lookup).mockImplementation(mimeTypesState.actualLookup);
});

function mockPhotoCtx(
  chatId: number,
  caption?: string,
  threadId?: number,
  messageId = 100,
  filePath = "photos/test.jpg",
) {
  return {
    chat: { id: chatId },
    msg: { message_thread_id: threadId },
    message: {
      ...(caption !== undefined && { caption }),
      message_id: messageId,
      photo: [{ file_id: "photo-small" }, { file_id: "photo-large" }],
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

function mockScope(overrides: {
  existingSessions?: ExistingSessions;
  opencodeClient?: ReturnType<typeof mockOpencodeClient>;
  pendingPrompts?: ReturnType<typeof mockPendingPrompts>;
  workingSessions?: ReturnType<typeof mockWorkingSessions>;
}): Scope {
  return {
    shutdown: {} as never,
    bot: {} as never,
    database: {} as never,
    opencodeClient: (overrides.opencodeClient ?? mockOpencodeClient()) as never,
    floatingPromises: {} as never,
    existingSessions: overrides.existingSessions ?? mockExistingSessions(),
    workingSessions: (overrides.workingSessions ??
      mockWorkingSessions()) as never,
    pendingPrompts: (overrides.pendingPrompts ?? mockPendingPrompts()) as never,
    processingMessages: {} as never,
    typingIndicators: {} as never,
  };
}

test("prompts opencode with a photo attachment", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(scope, mockPhotoCtx(42) as never, signal);

  expect(pendingPrompts.answer).not.toHaveBeenCalled();
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
          mime: "image/jpeg",
          filename: "test.jpg",
          url: "data:image/jpeg;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
  expect(fetch).toHaveBeenCalledWith(
    new URL("photos/test.jpg", "https://api.telegram.org/file/bottest-token/"),
  );
});

test("preserves Telegram file name and download mime type", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "image/png; charset=binary" },
    }),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(
      42,
      undefined,
      undefined,
      100,
      "photos/original-name.png",
    ) as never,
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
          mime: "image/png",
          filename: "original-name.png",
          url: "data:image/png;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
});

test("falls back to file-path image mime when Telegram serves octet-stream", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "application/octet-stream" },
    }),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(
      42,
      undefined,
      undefined,
      100,
      "photos/original-name.png",
    ) as never,
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
          mime: "image/png",
          filename: "original-name.png",
          url: "data:image/png;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
});

test("prompts opencode with caption text on a photo message", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(42, "describe this", undefined, 55) as never,
    signal,
  );

  expect(pendingPrompts.answer).not.toHaveBeenCalled();
  expect(pendingPrompts.protect).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 55,
  });
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        { type: "text", text: "describe this" },
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
});

test("does not push an empty caption as a text part", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(42, "", undefined, 55) as never,
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
});

test("notifies about pending prompt for photo without caption", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockResolvedValue(undefined);
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(42, undefined, undefined, 77) as never,
    signal,
  );

  expect(pendingPrompts.protect).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 77,
  });
  expect(pendingPrompts.answer).not.toHaveBeenCalled();
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("notifies about pending prompt for photo with caption", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockResolvedValue(undefined);
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(42, "describe this", undefined, 77) as never,
    signal,
  );

  expect(pendingPrompts.protect).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 77,
  });
  expect(pendingPrompts.answer).not.toHaveBeenCalled();
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("continues with photo prompt when pending notice is already gone", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockRejectedValue(new PendingPrompts.NotFoundError());
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(42, undefined, undefined, 77) as never,
    signal,
  );

  expect(pendingPrompts.answer).not.toHaveBeenCalled();
  expect(pendingPrompts.protect).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 77,
  });
  expect(opencodeClient.session.promptAsync).toHaveBeenCalled();
});

test("creates new session when none exists", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(scope, mockPhotoCtx(42) as never, signal);

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

  await grammyHandlePhoto(scope, mockPhotoCtx(42) as never, signal);

  expect(pendingPrompts.protect).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 100,
  });
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      agent: "build",
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
});

test("sends pending message when session is locked", async () => {
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

  await grammyHandlePhoto(scope, mockPhotoCtx(42) as never, signal);

  expect(grammySendSessionPending).toHaveBeenCalledWith({
    bot: scope.bot,
    chatId: 42,
    threadId: undefined,
    replyToMessageId: 100,
  });
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("passes threadId through the flow", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(42, "caption", 7) as never,
    signal,
  );

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: 7 },
    { createIfNotFound: true },
  );
  expect(pendingPrompts.protect).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 100,
  });
  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      parts: [
        { type: "text", text: "caption" },
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
});

test("falls back to a default file name when Telegram omits one", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "image/webp" },
    }),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(42, undefined, undefined, 100, "/") as never,
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
          mime: "image/webp",
          filename: "telegram-photo.webp",
          url: "data:image/webp;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
});

test("falls back to jpeg mime when file path has no extension", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(42, undefined, undefined, 100, "photos/file.") as never,
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
          mime: "image/jpeg",
          filename: "file.",
          url: "data:image/jpeg;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
});

test("falls back to jpeg mime when file extension is unknown", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(42, undefined, undefined, 100, "photos/file.bin") as never,
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
          mime: "image/jpeg",
          filename: "file.bin",
          url: "data:image/jpeg;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
});

test("falls back to jpeg mime and suffix when header is invalid", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "image" },
    }),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(42, undefined, undefined, 100, "/") as never,
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
          mime: "image/jpeg",
          filename: "telegram-photo.jpg",
          url: "data:image/jpeg;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
});

test("falls back to jpeg mime when file-path lookup throws", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "application/octet-stream" },
    }),
  );
  vi.mocked(lookup).mockImplementation(() => {
    throw new Error("lookup failed");
  });
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(42, undefined, undefined, 100, "/") as never,
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
          mime: "image/jpeg",
          filename: "telegram-photo.jpg",
          url: "data:image/jpeg;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
});

test("falls back to a jpeg suffix when image mime has no known extension", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "image/foo" },
    }),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await grammyHandlePhoto(
    scope,
    mockPhotoCtx(42, undefined, undefined, 100, "/") as never,
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
          mime: "image/foo",
          filename: "telegram-photo.jpeg",
          url: "data:image/foo;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
});

test("rethrows when Telegram photo has no file path", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  const ctx = mockPhotoCtx(42);
  ctx.getFile.mockResolvedValue({ file_path: undefined });
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await expect(grammyHandlePhoto(scope, ctx as never, signal)).rejects.toThrow(
    "Expected Telegram photo to have a file path",
  );
});

test("rethrows when Telegram photo download fails", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("nope", { status: 500 }),
  );
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await expect(
    grammyHandlePhoto(scope, mockPhotoCtx(42) as never, signal),
  ).rejects.toThrow("Expected Telegram photo download to succeed");
});

test("rethrows non-PendingPrompts.NotFoundError from protect", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const error = new Error("unexpected");
  pendingPrompts.protect.mockRejectedValue(error);
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
  });

  await expect(
    grammyHandlePhoto(scope, mockPhotoCtx(42) as never, signal),
  ).rejects.toBe(error);
});

test("rethrows errors from lock", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const error = new Error("unexpected");
  const workingSessions = mockWorkingSessions();
  workingSessions.lock.mockRejectedValue(error);
  const scope = mockScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
    workingSessions,
  });

  await expect(
    grammyHandlePhoto(scope, mockPhotoCtx(42) as never, signal),
  ).rejects.toBe(error);
});
