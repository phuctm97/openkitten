import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { logger } from "~/lib/logger";
import { StreamingMessages } from "~/lib/streaming-messages";

type MockFn = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

let mockSendMessageDraft: MockFn;

function createMessage(
  messageId: string,
  parts: readonly {
    readonly type: string;
    readonly text?: string;
  }[] = [],
  sessionId = "sess-1",
) {
  return {
    info: { id: messageId, sessionID: sessionId },
    parts,
  };
}

function createMockBot() {
  return {
    api: {
      sendMessageDraft: (...args: unknown[]) => mockSendMessageDraft(...args),
    },
  } as never;
}

function createMockExistingSessions(
  map: Record<string, ExistingSessions.Location> = {
    "sess-1": { chatId: 123, threadId: undefined },
  },
) {
  return {
    get: vi.fn((sessionId: string, _options: ExistingSessions.GetOptions) => {
      const location = map[sessionId];
      if (!location) throw new Error(`No session found: ${sessionId}`);
      return location;
    }),
  } as never;
}

function setup(
  map: Record<string, ExistingSessions.Location> = {
    "sess-1": { chatId: 123, threadId: undefined },
  },
) {
  const bot = createMockBot();
  const existingSessions = createMockExistingSessions(map);
  const streamingMessages = StreamingMessages.create(bot, existingSessions);
  return { bot, existingSessions, streamingMessages };
}

beforeEach(() => {
  vi.useFakeTimers();
  mockSendMessageDraft = vi.fn(async () => true);
});

afterEach(() => {
  vi.useRealTimers();
});

test("update sends a draft message to a chat", async () => {
  const { streamingMessages } = setup();
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).toHaveBeenCalledTimes(1);
  const firstCall = mockSendMessageDraft.mock.calls[0];
  if (!firstCall) throw new Error("Expected a draft send call");
  const [chatId, draftId, text, options] = firstCall;
  expect(chatId).toBe(123);
  expect(draftId).toBeTypeOf("number");
  expect(draftId).not.toBe(0);
  expect(text).toBe("hello");
  expect(options).toEqual({});
});

test("update includes the thread id when present", async () => {
  const { streamingMessages } = setup({
    "sess-1": { chatId: 123, threadId: 456 },
  });
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).toHaveBeenCalledWith(
    123,
    expect.any(Number),
    "hello",
    { message_thread_id: 456 },
  );
});

test("update ignores empty text", async () => {
  const { streamingMessages } = setup();
  streamingMessages.update(createMessage("m1", [{ type: "text", text: "" }]));
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).not.toHaveBeenCalled();
});

test("update truncates text to Telegram draft limits", async () => {
  const { streamingMessages } = setup();
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "x".repeat(5000) }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  const firstCall = mockSendMessageDraft.mock.calls[0];
  if (!firstCall) throw new Error("Expected a draft send call");
  const text = firstCall[2];
  if (typeof text !== "string") throw new Error("Expected draft text");
  expect(text).toHaveLength(4096);
  expect(text.endsWith("…")).toBe(true);
});

test("update sends draft messages to supergroups", async () => {
  const { streamingMessages } = setup({
    "sess-1": { chatId: -100123, threadId: undefined },
  });
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).toHaveBeenCalledWith(
    -100123,
    expect.any(Number),
    "hello",
    {},
  );
});

test("update skips draft sends when the session no longer exists", async () => {
  const { streamingMessages } = setup({});
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).not.toHaveBeenCalled();
});

test("update coalesces scheduled changes to the latest text", async () => {
  const { streamingMessages } = setup();
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello world" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).toHaveBeenCalledTimes(1);
  expect(mockSendMessageDraft).toHaveBeenCalledWith(
    123,
    expect.any(Number),
    "hello world",
    {},
  );
});

test("update resends the latest text after an in-flight send settles", async () => {
  let resolveFirst = () => {};
  let firstCall = true;
  mockSendMessageDraft = vi.fn(async () => {
    if (!firstCall) return true;
    firstCall = false;
    await new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    return true;
  });
  const { streamingMessages } = setup();
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello world" }]),
  );
  expect(mockSendMessageDraft).toHaveBeenCalledTimes(1);
  resolveFirst();
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).toHaveBeenCalledTimes(2);
  expect(mockSendMessageDraft.mock.calls[1]?.[2]).toBe("hello world");
});

test("update uses a new draft id when the message id changes", async () => {
  const { streamingMessages } = setup();
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  const firstDraftId = mockSendMessageDraft.mock.calls[0]?.[1];
  streamingMessages.update(
    createMessage("m2", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  const secondDraftId = mockSendMessageDraft.mock.calls[1]?.[1];
  expect(firstDraftId).not.toBe(secondDraftId);
});

test("update does not resend the same text for the same message", async () => {
  const { streamingMessages } = setup();
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).toHaveBeenCalledTimes(1);
});

test("update drops a queued resend if it collapses back to already-sent text", async () => {
  const { streamingMessages } = setup();
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello world" }]),
  );
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).toHaveBeenCalledTimes(1);
});

test("update can clear text for an existing state without sending again", async () => {
  const { streamingMessages } = setup();
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  streamingMessages.update(createMessage("m1"));
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).toHaveBeenCalledTimes(1);
});

test("update drops a scheduled draft when the text is cleared before flush", async () => {
  const { streamingMessages } = setup();
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  streamingMessages.update(createMessage("m1"));
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).not.toHaveBeenCalled();
});

test("clear cancels a scheduled draft send", async () => {
  const { streamingMessages } = setup();
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await streamingMessages.clear("sess-1");
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).not.toHaveBeenCalled();
});

test("clear ignores sessions without draft state", async () => {
  const { streamingMessages } = setup();
  await streamingMessages.clear("sess-2");
  expect(mockSendMessageDraft).not.toHaveBeenCalled();
});

test("clear waits for an in-flight draft send", async () => {
  let resolveFirst = () => {};
  let firstCall = true;
  mockSendMessageDraft = vi.fn(async () => {
    if (!firstCall) return Promise.resolve(true);
    firstCall = false;
    await new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    return true;
  });
  const { streamingMessages } = setup();
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  const cleared = streamingMessages.clear("sess-1");
  let settled = false;
  void cleared.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  resolveFirst();
  await cleared;
  streamingMessages.update(
    createMessage("m2", [{ type: "text", text: "world" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).toHaveBeenCalledTimes(2);
});

test("update logs a warning when a draft send fails", async () => {
  vi.mocked(logger.warn).mockClear();
  mockSendMessageDraft = vi.fn(async () => {
    throw new Error("boom");
  });
  const { streamingMessages } = setup();
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(logger.warn).toHaveBeenCalledWith(
    "Failed to stream Telegram draft message",
    expect.any(Error),
    { sessionId: "sess-1", messageId: "m1" },
  );
});

test("dispose clears pending draft sends", async () => {
  const { streamingMessages } = setup();
  streamingMessages.update(
    createMessage("m1", [{ type: "text", text: "hello" }]),
  );
  await streamingMessages[Symbol.asyncDispose]();
  await vi.advanceTimersByTimeAsync(StreamingMessages.delay);
  expect(mockSendMessageDraft).not.toHaveBeenCalled();
});
