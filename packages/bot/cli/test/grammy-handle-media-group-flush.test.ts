import { beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyHandleMediaGroupFlush } from "~/lib/grammy-handle-media-group-flush";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import type { MediaGroupBuffer } from "~/lib/media-group-buffer";
import { PendingPrompts } from "~/lib/pending-prompts";
import { WorkingSessions } from "~/lib/working-sessions";

vi.mock("~/lib/get-session-agent");
vi.mock("~/lib/grammy-send-session-pending");

beforeEach(() => {
  vi.resetAllMocks();
});

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

function mockOpencodeClient() {
  return {
    session: {
      create: vi.fn(),
      delete: vi.fn(),
      promptAsync: vi.fn(),
    },
  };
}

function makeEntry(
  overrides: Partial<MediaGroupBuffer.Entry> & {
    parts?: readonly MediaGroupBuffer.Part[];
  } = {},
): MediaGroupBuffer.Entry {
  const { parts, ...rest } = overrides;
  const resolvedParts = parts ?? [{ type: "text" as const, text: "hello" }];
  return {
    chatId: 42,
    threadId: undefined,
    messageId: 100,
    download: async () => resolvedParts,
    ...rest,
  };
}

function makeScope(overrides: {
  existingSessions?: ExistingSessions;
  opencodeClient?: ReturnType<typeof mockOpencodeClient>;
  pendingPrompts?: ReturnType<typeof mockPendingPrompts>;
  workingSessions?: ReturnType<typeof mockWorkingSessions>;
}) {
  return {
    bot: {} as never,
    database: {} as never,
    opencodeClient: (overrides.opencodeClient ?? mockOpencodeClient()) as never,
    existingSessions: overrides.existingSessions ?? mockExistingSessions(),
    workingSessions: (overrides.workingSessions ??
      mockWorkingSessions()) as never,
    pendingPrompts: (overrides.pendingPrompts ?? mockPendingPrompts()) as never,
  };
}

test("combines parts from multiple entries, finds session, sends prompt", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});

  const entries: readonly MediaGroupBuffer.Entry[] = [
    makeEntry({ messageId: 100, parts: [{ type: "text", text: "hello" }] }),
    makeEntry({
      messageId: 101,
      parts: [
        {
          type: "file",
          mime: "image/jpeg",
          filename: "photo.jpg",
          url: "data:image/jpeg;base64,AQID",
        },
      ],
    }),
  ];

  const scope = makeScope({ existingSessions, opencodeClient, pendingPrompts });
  await grammyHandleMediaGroupFlush(scope, entries);

  expect(existingSessions.find).toHaveBeenCalledWith(
    { chatId: 42, threadId: undefined },
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
        { type: "text", text: "hello" },
        {
          type: "file",
          mime: "image/jpeg",
          filename: "photo.jpg",
          url: "data:image/jpeg;base64,AQID",
        },
      ],
    },
    { throwOnError: true },
  );
});

test("passes agent to promptAsync when getSessionAgent returns a value", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  opencodeClient.session.promptAsync.mockResolvedValue({});
  vi.mocked(getSessionAgent).mockReturnValue("build");

  const entries: readonly MediaGroupBuffer.Entry[] = [
    makeEntry({ parts: [{ type: "text", text: "hi" }] }),
  ];

  const scope = makeScope({ existingSessions, opencodeClient, pendingPrompts });
  await grammyHandleMediaGroupFlush(scope, entries);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalledWith(
    {
      sessionID: "s1",
      agent: "build",
      parts: [{ type: "text", text: "hi" }],
    },
    { throwOnError: true },
  );
});

test("returns early without sending when protect succeeds", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockResolvedValue(undefined);

  const entries: readonly MediaGroupBuffer.Entry[] = [makeEntry()];

  const scope = makeScope({ existingSessions, opencodeClient, pendingPrompts });
  await grammyHandleMediaGroupFlush(scope, entries);

  expect(pendingPrompts.protect).toHaveBeenCalledWith({
    sessionId: "s1",
    messageId: 100,
  });
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("continues when protect throws PendingPrompts.NotFoundError", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  pendingPrompts.protect.mockRejectedValue(new PendingPrompts.NotFoundError());
  opencodeClient.session.promptAsync.mockResolvedValue({});

  const entries: readonly MediaGroupBuffer.Entry[] = [
    makeEntry({ parts: [{ type: "text", text: "msg" }] }),
  ];

  const scope = makeScope({ existingSessions, opencodeClient, pendingPrompts });
  await grammyHandleMediaGroupFlush(scope, entries);

  expect(opencodeClient.session.promptAsync).toHaveBeenCalled();
});

test("rethrows non-NotFoundError from protect", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const error = new Error("unexpected protect error");
  pendingPrompts.protect.mockRejectedValue(error);

  const entries: readonly MediaGroupBuffer.Entry[] = [makeEntry()];

  const scope = makeScope({ existingSessions, opencodeClient, pendingPrompts });
  await expect(grammyHandleMediaGroupFlush(scope, entries)).rejects.toBe(error);
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});

test("sends session pending message when session is locked", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const workingSessions = mockWorkingSessions();
  workingSessions.lock.mockRejectedValue(new WorkingSessions.LockedError("s1"));

  const entries: readonly MediaGroupBuffer.Entry[] = [
    makeEntry({ chatId: 42, threadId: undefined, messageId: 100 }),
  ];

  const scope = makeScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
    workingSessions,
  });
  await grammyHandleMediaGroupFlush(scope, entries);

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
  const workingSessions = mockWorkingSessions();
  const error = new Error("unexpected lock error");
  workingSessions.lock.mockRejectedValue(error);

  const entries: readonly MediaGroupBuffer.Entry[] = [makeEntry()];

  const scope = makeScope({
    existingSessions,
    opencodeClient,
    pendingPrompts,
    workingSessions,
  });
  await expect(grammyHandleMediaGroupFlush(scope, entries)).rejects.toBe(error);
  expect(grammySendSessionPending).not.toHaveBeenCalled();
});

test("throws invariant error when entries array is empty", async () => {
  const scope = makeScope({});
  await expect(grammyHandleMediaGroupFlush(scope, [])).rejects.toThrow(
    "Expected at least one entry in media group",
  );
});

test("rejects when a single download fails inside Promise.all", async () => {
  const existingSessions = mockExistingSessions();
  const opencodeClient = mockOpencodeClient();
  const pendingPrompts = mockPendingPrompts();
  const downloadError = new Error("network failure");

  const entries: readonly MediaGroupBuffer.Entry[] = [
    makeEntry({ parts: [{ type: "text", text: "ok" }] }),
    makeEntry({
      messageId: 101,
      download: async () => {
        throw downloadError;
      },
    }),
  ];

  const scope = makeScope({ existingSessions, opencodeClient, pendingPrompts });
  await expect(grammyHandleMediaGroupFlush(scope, entries)).rejects.toBe(
    downloadError,
  );
  expect(opencodeClient.session.promptAsync).not.toHaveBeenCalled();
});
