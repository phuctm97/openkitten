import { consola } from "consola";
import { expect, test, vi } from "vitest";
import { createPendingPrompts } from "~/lib/create-pending-prompts";

type MockFn = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

let mockQuestionList: MockFn;
let mockQuestionReject: MockFn;
let mockPermissionList: MockFn;
let mockPermissionReply: MockFn;

function createMockOpencodeClient() {
  mockQuestionList = vi.fn(async () => ({ data: [] }));
  mockQuestionReject = vi.fn(async () => ({}));
  mockPermissionList = vi.fn(async () => ({ data: [] }));
  mockPermissionReply = vi.fn(async () => ({}));
  return {
    question: {
      list: (...args: unknown[]) => mockQuestionList(...args),
      reject: (...args: unknown[]) => mockQuestionReject(...args),
    },
    permission: {
      list: (...args: unknown[]) => mockPermissionList(...args),
      reply: (...args: unknown[]) => mockPermissionReply(...args),
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
const session2 = {
  id: "sess-2",
  chatId: 456,
  threadId: 789,
  createdAt: now,
  updatedAt: now,
};

test("tracks sessions with pending questions", async () => {
  const client = createMockOpencodeClient();
  mockQuestionList = vi.fn(async () => ({
    data: [{ id: "q1", sessionID: "sess-1" }],
  }));
  using prompts = createPendingPrompts(client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("tracks sessions with pending permissions", async () => {
  const client = createMockOpencodeClient();
  mockPermissionList = vi.fn(async () => ({
    data: [{ id: "p1", sessionID: "sess-1" }],
  }));
  using prompts = createPendingPrompts(client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("tracks sessions with both questions and permissions", async () => {
  const client = createMockOpencodeClient();
  mockQuestionList = vi.fn(async () => ({
    data: [{ id: "q1", sessionID: "sess-1" }],
  }));
  mockPermissionList = vi.fn(async () => ({
    data: [{ id: "p1", sessionID: "sess-1" }],
  }));
  using prompts = createPendingPrompts(client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("does not track sessions without pending prompts", async () => {
  const client = createMockOpencodeClient();
  using prompts = createPendingPrompts(client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual([]);
});

test("removes session when prompts are resolved", async () => {
  const client = createMockOpencodeClient();
  mockQuestionList = vi.fn(async () => ({
    data: [{ id: "q1", sessionID: "sess-1" }],
  }));
  using prompts = createPendingPrompts(client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
  mockQuestionList = vi.fn(async () => ({ data: [] }));
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual([]);
});

test("tracks multiple sessions independently", async () => {
  const client = createMockOpencodeClient();
  mockQuestionList = vi.fn(async () => ({
    data: [
      { id: "q1", sessionID: "sess-1" },
      { id: "q2", sessionID: "sess-2" },
    ],
  }));
  using prompts = createPendingPrompts(client);
  await prompts.invalidate(session, session2);
  expect(prompts.sessionIds).toEqual(["sess-1", "sess-2"]);
});

test("dismiss rejects questions and denies permissions", async () => {
  const client = createMockOpencodeClient();
  mockQuestionList = vi.fn(async () => ({
    data: [{ id: "q1", sessionID: "sess-1" }],
  }));
  mockPermissionList = vi.fn(async () => ({
    data: [{ id: "p1", sessionID: "sess-1" }],
  }));
  using prompts = createPendingPrompts(client);
  await prompts.invalidate(session);
  prompts.dismiss("sess-1");
  expect(mockQuestionReject).toHaveBeenCalledWith({ requestID: "q1" });
  expect(mockPermissionReply).toHaveBeenCalledWith({
    requestID: "p1",
    reply: "reject",
  });
  expect(prompts.sessionIds).toEqual([]);
});

test("dismiss handles multiple questions and permissions", async () => {
  const client = createMockOpencodeClient();
  mockQuestionList = vi.fn(async () => ({
    data: [
      { id: "q1", sessionID: "sess-1" },
      { id: "q2", sessionID: "sess-1" },
    ],
  }));
  mockPermissionList = vi.fn(async () => ({
    data: [
      { id: "p1", sessionID: "sess-1" },
      { id: "p2", sessionID: "sess-1" },
    ],
  }));
  using prompts = createPendingPrompts(client);
  await prompts.invalidate(session);
  prompts.dismiss("sess-1");
  expect(mockQuestionReject).toHaveBeenCalledTimes(2);
  expect(mockPermissionReply).toHaveBeenCalledTimes(2);
});

test("dismiss is no-op for unknown session", async () => {
  const client = createMockOpencodeClient();
  using prompts = createPendingPrompts(client);
  prompts.dismiss("unknown");
  expect(mockQuestionReject).not.toHaveBeenCalled();
  expect(mockPermissionReply).not.toHaveBeenCalled();
});

test("dismiss logs warning on question reject failure", async () => {
  const client = createMockOpencodeClient();
  mockQuestionList = vi.fn(async () => ({
    data: [{ id: "q1", sessionID: "sess-1" }],
  }));
  const error = new Error("reject failed");
  mockQuestionReject = vi.fn(async () => {
    throw error;
  });
  using prompts = createPendingPrompts(client);
  await prompts.invalidate(session);
  prompts.dismiss("sess-1");
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "pending prompt dismiss question failed",
      { sessionId: "sess-1", requestID: "q1" },
      error,
    ),
  );
});

test("dismiss logs warning on permission reply failure", async () => {
  const client = createMockOpencodeClient();
  mockPermissionList = vi.fn(async () => ({
    data: [{ id: "p1", sessionID: "sess-1" }],
  }));
  const error = new Error("reply failed");
  mockPermissionReply = vi.fn(async () => {
    throw error;
  });
  using prompts = createPendingPrompts(client);
  await prompts.invalidate(session);
  prompts.dismiss("sess-1");
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "pending prompt dismiss permission failed",
      { sessionId: "sess-1", requestID: "p1" },
      error,
    ),
  );
});

test("dismiss logs debug message", async () => {
  const client = createMockOpencodeClient();
  mockQuestionList = vi.fn(async () => ({
    data: [{ id: "q1", sessionID: "sess-1" }],
  }));
  using prompts = createPendingPrompts(client);
  await prompts.invalidate(session);
  prompts.dismiss("sess-1");
  expect(consola.debug).toHaveBeenCalledWith("pending prompts dismissed", {
    sessionId: "sess-1",
  });
});

test("throws when question list API fails", async () => {
  const client = createMockOpencodeClient();
  mockQuestionList = vi.fn(async () => ({
    error: new Error("question api down"),
  }));
  using prompts = createPendingPrompts(client);
  await expect(prompts.invalidate(session)).rejects.toThrow(
    "question api down",
  );
});

test("throws when permission list API fails", async () => {
  const client = createMockOpencodeClient();
  mockPermissionList = vi.fn(async () => ({
    error: new Error("permission api down"),
  }));
  using prompts = createPendingPrompts(client);
  await expect(prompts.invalidate(session)).rejects.toThrow(
    "permission api down",
  );
});

test("handles undefined question and permission data", async () => {
  const client = createMockOpencodeClient();
  mockQuestionList = vi.fn(async () => ({ data: undefined }));
  mockPermissionList = vi.fn(async () => ({ data: undefined }));
  using prompts = createPendingPrompts(client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual([]);
});

test("dispose dismisses all tracked sessions", async () => {
  const client = createMockOpencodeClient();
  mockQuestionList = vi.fn(async () => ({
    data: [
      { id: "q1", sessionID: "sess-1" },
      { id: "q2", sessionID: "sess-2" },
    ],
  }));
  {
    using prompts = createPendingPrompts(client);
    await prompts.invalidate(session, session2);
    expect(prompts.sessionIds).toEqual(["sess-1", "sess-2"]);
  }
  expect(mockQuestionReject).toHaveBeenCalledTimes(2);
});

test("only invalidates given sessions", async () => {
  const client = createMockOpencodeClient();
  mockQuestionList = vi.fn(async () => ({
    data: [
      { id: "q1", sessionID: "sess-1" },
      { id: "q2", sessionID: "sess-2" },
    ],
  }));
  using prompts = createPendingPrompts(client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});
