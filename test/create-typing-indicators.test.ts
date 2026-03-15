import { consola } from "consola";
import { GrammyError } from "grammy";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createTypingIndicators } from "~/lib/create-typing-indicators";

type MockFn = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

let mockSendChatAction: MockFn;
let mockSessionStatus: MockFn;
let mockQuestionList: MockFn;
let mockPermissionList: MockFn;

function createMockBot() {
  return {
    api: {
      sendChatAction: (...args: unknown[]) => mockSendChatAction(...args),
    },
  } as never;
}

function createMockOpencodeClient() {
  return {
    session: {
      status: (...args: unknown[]) => mockSessionStatus(...args),
    },
    question: {
      list: (...args: unknown[]) => mockQuestionList(...args),
    },
    permission: {
      list: (...args: unknown[]) => mockPermissionList(...args),
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

beforeEach(() => {
  vi.useFakeTimers();
  mockSendChatAction = vi.fn(async () => {});
  mockSessionStatus = vi.fn(async () => ({ data: {} }));
  mockQuestionList = vi.fn(async () => ({ data: [] }));
  mockPermissionList = vi.fn(async () => ({ data: [] }));
});

afterEach(() => {
  vi.useRealTimers();
});

test("exposes active session ids", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" }, "sess-2": { type: "busy" } },
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  expect(indicators.sessionIds).toEqual([]);
  await indicators.invalidate(session, threadSession);
  expect(indicators.sessionIds).toEqual(["sess-1", "sess-2"]);
  indicators.stop("sess-1");
  expect(indicators.sessionIds).toEqual(["sess-2"]);
});

test("invalidate with no sessions skips API calls", async () => {
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await indicators.invalidate();
  expect(mockSessionStatus).not.toHaveBeenCalled();
  expect(mockQuestionList).not.toHaveBeenCalled();
  expect(mockPermissionList).not.toHaveBeenCalled();
});

test("starts typing when busy with no questions or permissions", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" } },
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).toHaveBeenCalledWith(123, "typing", {});
});

test("starts typing when retry with no questions or permissions", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "retry" } },
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).toHaveBeenCalledWith(123, "typing", {});
});

test("does not start typing when idle", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "idle" } },
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await indicators.invalidate(session);
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("does not start typing when session has no status", async () => {
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await indicators.invalidate(session);
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("stops typing when question is pending", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" } },
  }));
  mockQuestionList = vi.fn(async () => ({
    data: [{ sessionID: "sess-1" }],
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await indicators.invalidate(session);
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("stops typing when permission is pending", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" } },
  }));
  mockPermissionList = vi.fn(async () => ({
    data: [{ sessionID: "sess-1" }],
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await indicators.invalidate(session);
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("is idempotent when already typing", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" } },
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  await indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  // Only 1 initial send, not 2
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
});

test("stops typing on invalidate when session becomes idle", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" } },
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "idle" } },
  }));
  await indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(4_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
});

test.each([
  {
    api: "session status",
    setup: () => {
      mockSessionStatus = vi.fn(async () => {
        throw new Error("api down");
      });
    },
  },
  {
    api: "question list",
    setup: () => {
      mockQuestionList = vi.fn(async () => {
        throw new Error("api down");
      });
    },
  },
  {
    api: "permission list",
    setup: () => {
      mockPermissionList = vi.fn(async () => {
        throw new Error("api down");
      });
    },
  },
])("throws when $api API fails", async ({ setup: setupMock }) => {
  setupMock();
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await expect(indicators.invalidate(session)).rejects.toThrow("api down");
});

test("stop with no args is a no-op", () => {
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  indicators.stop();
});

test("disposes all active timers", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" }, "sess-2": { type: "busy" } },
  }));
  {
    using indicators = createTypingIndicators(
      createMockBot(),
      createMockOpencodeClient(),
    );
    await indicators.invalidate(session, threadSession);
    await vi.advanceTimersByTimeAsync(0);
  }
  const countAfterDispose = mockSendChatAction.mock.calls.length;
  await vi.advanceTimersByTimeAsync(8_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(countAfterDispose);
});

test("sends typing action every 4 seconds", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" } },
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(4_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(4_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(3);
});

test("passes thread id when present", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-2": { type: "busy" } },
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await indicators.invalidate(threadSession);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).toHaveBeenCalledWith(456, "typing", {
    message_thread_id: 789,
  });
});

test("logs warning on send failure", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" } },
  }));
  const error = new Error("network error");
  mockSendChatAction = vi.fn(async () => {
    throw error;
  });
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(consola.warn).toHaveBeenCalledWith(
    "Failed to send typing indicator to Telegram",
    { error, sessionId: "sess-1", chatId: 123, threadId: undefined },
  );
});

test("self-removes on gone error", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" } },
  }));
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
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  await indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(indicators.sessionIds).toEqual([]);
  expect(consola.warn).not.toHaveBeenCalled();
});
