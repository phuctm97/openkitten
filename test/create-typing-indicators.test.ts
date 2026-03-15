import { consola } from "consola";
import { GrammyError } from "grammy";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createTypingIndicators } from "~/lib/create-typing-indicators";
import type { OpencodeSnapshot } from "~/lib/opencode-snapshot";

type MockFn = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

let mockSendChatAction: MockFn;

function createMockBot() {
  return {
    api: {
      sendChatAction: (...args: unknown[]) => mockSendChatAction(...args),
    },
  } as never;
}

const now = new Date();
const session = {
  id: "sess-1",
  chatId: 123,
  threadId: 0,
  createdAt: now,
  updatedAt: now,
};
const threadSession = {
  id: "sess-2",
  chatId: 456,
  threadId: 789,
  createdAt: now,
  updatedAt: now,
};

const emptySnapshot: OpencodeSnapshot = {
  statuses: {},
  questions: [],
  permissions: [],
};

beforeEach(() => {
  vi.useFakeTimers();
  mockSendChatAction = vi.fn(async () => {});
});

afterEach(() => {
  vi.useRealTimers();
});

test("exposes active session ids", async () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" }, "sess-2": { type: "busy" } },
    questions: [],
    permissions: [],
  };
  using indicators = createTypingIndicators(createMockBot());
  expect(indicators.sessionIds).toEqual([]);
  await indicators.invalidate(snapshot, session, threadSession);
  expect(indicators.sessionIds).toEqual(["sess-1", "sess-2"]);
  indicators.stop("sess-1");
  expect(indicators.sessionIds).toEqual(["sess-2"]);
});

test("invalidate with no sessions skips processing", async () => {
  using indicators = createTypingIndicators(createMockBot());
  await indicators.invalidate(emptySnapshot);
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("starts typing when busy with no questions or permissions", async () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" } },
    questions: [],
    permissions: [],
  };
  using indicators = createTypingIndicators(createMockBot());
  await indicators.invalidate(snapshot, session);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).toHaveBeenCalledWith(123, "typing", {});
});

test("starts typing when retry with no questions or permissions", async () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "retry", attempt: 1, message: "", next: 0 } },
    questions: [],
    permissions: [],
  };
  using indicators = createTypingIndicators(createMockBot());
  await indicators.invalidate(snapshot, session);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).toHaveBeenCalledWith(123, "typing", {});
});

test("does not start typing when idle", async () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "idle" } },
    questions: [],
    permissions: [],
  };
  using indicators = createTypingIndicators(createMockBot());
  await indicators.invalidate(snapshot, session);
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("does not start typing when session has no status", async () => {
  using indicators = createTypingIndicators(createMockBot());
  await indicators.invalidate(emptySnapshot, session);
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("stops typing when question is pending", async () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" } },
    questions: [{ sessionID: "sess-1" }] as never,
    permissions: [],
  };
  using indicators = createTypingIndicators(createMockBot());
  await indicators.invalidate(snapshot, session);
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("stops typing when permission is pending", async () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" } },
    questions: [],
    permissions: [{ sessionID: "sess-1" }] as never,
  };
  using indicators = createTypingIndicators(createMockBot());
  await indicators.invalidate(snapshot, session);
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("is idempotent when already typing", async () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" } },
    questions: [],
    permissions: [],
  };
  using indicators = createTypingIndicators(createMockBot());
  await indicators.invalidate(snapshot, session);
  await vi.advanceTimersByTimeAsync(0);
  await indicators.invalidate(snapshot, session);
  await vi.advanceTimersByTimeAsync(0);
  // Only 1 initial send, not 2
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
});

test("stops typing on invalidate when session becomes idle", async () => {
  const busySnapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" } },
    questions: [],
    permissions: [],
  };
  using indicators = createTypingIndicators(createMockBot());
  await indicators.invalidate(busySnapshot, session);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
  const idleSnapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "idle" } },
    questions: [],
    permissions: [],
  };
  await indicators.invalidate(idleSnapshot, session);
  await vi.advanceTimersByTimeAsync(4_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
});

test("stop with no args is a no-op", () => {
  using indicators = createTypingIndicators(createMockBot());
  indicators.stop();
});

test("disposes all active timers", async () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" }, "sess-2": { type: "busy" } },
    questions: [],
    permissions: [],
  };
  {
    using indicators = createTypingIndicators(createMockBot());
    await indicators.invalidate(snapshot, session, threadSession);
    await vi.advanceTimersByTimeAsync(0);
  }
  const countAfterDispose = mockSendChatAction.mock.calls.length;
  await vi.advanceTimersByTimeAsync(8_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(countAfterDispose);
});

test("sends typing action every 4 seconds", async () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" } },
    questions: [],
    permissions: [],
  };
  using indicators = createTypingIndicators(createMockBot());
  await indicators.invalidate(snapshot, session);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(4_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(4_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(3);
});

test("passes thread id when present", async () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-2": { type: "busy" } },
    questions: [],
    permissions: [],
  };
  using indicators = createTypingIndicators(createMockBot());
  await indicators.invalidate(snapshot, threadSession);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).toHaveBeenCalledWith(456, "typing", {
    message_thread_id: 789,
  });
});

test("logs warning on send failure", async () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" } },
    questions: [],
    permissions: [],
  };
  const error = new Error("network error");
  mockSendChatAction = vi.fn(async () => {
    throw error;
  });
  using indicators = createTypingIndicators(createMockBot());
  await indicators.invalidate(snapshot, session);
  await vi.advanceTimersByTimeAsync(0);
  expect(consola.warn).toHaveBeenCalledWith(
    "Failed to send typing indicator to Telegram",
    { error, sessionId: "sess-1", chatId: 123, threadId: undefined },
  );
});

test("self-removes on gone error", async () => {
  const snapshot: OpencodeSnapshot = {
    statuses: { "sess-1": { type: "busy" } },
    questions: [],
    permissions: [],
  };
  const error = new GrammyError(
    "Call to 'sendChatAction' failed! (403: Forbidden: bot was blocked by the user)",
    {
      ok: false,
      error_code: 403,
      description: "Forbidden: bot was blocked by the user",
    },
    "sendChatAction",
    {},
  );
  mockSendChatAction = vi.fn(async () => {
    throw error;
  });
  using indicators = createTypingIndicators(createMockBot());
  await indicators.invalidate(snapshot, session);
  await vi.advanceTimersByTimeAsync(0);
  expect(indicators.sessionIds).toEqual([]);
  expect(consola.warn).not.toHaveBeenCalled();
});
