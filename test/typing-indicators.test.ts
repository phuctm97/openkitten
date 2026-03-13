import { consola } from "consola";
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

test("starts typing when busy with no questions or permissions", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" } },
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  indicators.invalidate(session);
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
  indicators.invalidate(session);
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
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("does not start typing when session has no status", async () => {
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
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
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
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
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).not.toHaveBeenCalled();
});

test("sends typing action every 4 seconds", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" } },
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  indicators.invalidate(session);
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
  indicators.invalidate(threadSession);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).toHaveBeenCalledWith(456, "typing", {
    message_thread_id: 789,
  });
});

test("is idempotent when already typing", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" } },
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  indicators.invalidate(session);
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
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "idle" } },
  }));
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(4_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(1);
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
    indicators.invalidate(session);
    indicators.invalidate(threadSession);
    await vi.advanceTimersByTimeAsync(0);
  }
  const countAfterDispose = mockSendChatAction.mock.calls.length;
  await vi.advanceTimersByTimeAsync(8_000);
  expect(mockSendChatAction).toHaveBeenCalledTimes(countAfterDispose);
});

test("logs warning on sendChatAction failure", async () => {
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
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(consola.warn).toHaveBeenCalledWith(
    "typing indicator send error",
    error,
  );
});

test("logs error when session status API fails", async () => {
  mockSessionStatus = vi.fn(async () => ({
    error: new Error("status api down"),
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(consola.error).toHaveBeenCalledWith(
    "typing indicator check error",
    expect.any(Error),
  );
});

test("logs error when question list API fails", async () => {
  mockQuestionList = vi.fn(async () => ({
    error: new Error("question api down"),
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(consola.error).toHaveBeenCalledWith(
    "typing indicator check error",
    expect.any(Error),
  );
});

test("logs error when permission list API fails", async () => {
  mockPermissionList = vi.fn(async () => ({
    error: new Error("permission api down"),
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(consola.error).toHaveBeenCalledWith(
    "typing indicator check error",
    expect.any(Error),
  );
});

test("handles undefined question and permission data", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" } },
  }));
  mockQuestionList = vi.fn(async () => ({ data: undefined }));
  mockPermissionList = vi.fn(async () => ({ data: undefined }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(mockSendChatAction).toHaveBeenCalledWith(123, "typing", {});
});

test("logs debug on start and stop", async () => {
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "busy" } },
  }));
  using indicators = createTypingIndicators(
    createMockBot(),
    createMockOpencodeClient(),
  );
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(consola.debug).toHaveBeenCalledWith("typing indicator started", {
    chatId: 123,
    threadId: undefined,
  });
  mockSessionStatus = vi.fn(async () => ({
    data: { "sess-1": { type: "idle" } },
  }));
  indicators.invalidate(session);
  await vi.advanceTimersByTimeAsync(0);
  expect(consola.debug).toHaveBeenCalledWith("typing indicator stopped", {
    sessionId: "sess-1",
  });
});
