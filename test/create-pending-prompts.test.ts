import { consola } from "consola";
import { GrammyError } from "grammy";
import { expect, test, vi } from "vitest";
import { createPendingPrompts } from "~/lib/create-pending-prompts";

vi.mock("~/lib/grammy-send-chunks", () => ({
  grammySendChunks: vi.fn(async () => {}),
}));

type MockFn = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

let mockEditMessageText: MockFn;
let mockSendMessage: MockFn;
let mockQuestionList: MockFn;
let mockQuestionReject: MockFn;
let mockQuestionReply: MockFn;
let mockPermissionList: MockFn;
let mockPermissionReply: MockFn;

function createMockBot() {
  return {
    api: {
      editMessageText: (...args: unknown[]) => mockEditMessageText(...args),
      sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    },
  } as never;
}

function createMockOpencodeClient() {
  mockQuestionList = vi.fn(async () => ({ data: [] }));
  mockQuestionReject = vi.fn(async () => ({}));
  mockQuestionReply = vi.fn(async () => ({}));
  mockPermissionList = vi.fn(async () => ({ data: [] }));
  mockPermissionReply = vi.fn(async () => ({}));
  return {
    question: {
      list: (...args: unknown[]) => mockQuestionList(...args),
      reject: (...args: unknown[]) => mockQuestionReject(...args),
      reply: (...args: unknown[]) => mockQuestionReply(...args),
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

const permissionRequest = {
  id: "p1",
  sessionID: "sess-1",
  permission: "bash",
  patterns: ["echo hello"],
  metadata: {},
  always: [],
};

const questionRequest = {
  id: "q1",
  sessionID: "sess-1",
  questions: [
    {
      question: "Choose a model",
      header: "Model",
      options: [
        { label: "GPT-4", description: "OpenAI GPT-4" },
        { label: "Claude", description: "Anthropic Claude" },
        { label: "Gemini", description: "Google Gemini" },
      ],
    },
  ],
};

const multiQuestionRequest = {
  id: "mq1",
  sessionID: "sess-1",
  questions: [
    {
      question: "Choose a model",
      header: "Model",
      options: [
        { label: "GPT-4", description: "OpenAI GPT-4" },
        { label: "Claude", description: "Anthropic Claude" },
      ],
    },
    {
      question: "Choose a language",
      header: "Language",
      options: [
        { label: "TypeScript", description: "TS" },
        { label: "Python", description: "Py" },
      ],
    },
  ],
};

const multiSelectQuestionRequest = {
  id: "msq1",
  sessionID: "sess-1",
  questions: [
    {
      question: "Select features",
      header: "Features",
      options: [
        { label: "Auth", description: "Authentication" },
        { label: "DB", description: "Database" },
        { label: "API", description: "API Layer" },
      ],
      multiple: true,
    },
  ],
};

let messageIdCounter: number;

function setup() {
  messageIdCounter = 100;
  mockEditMessageText = vi.fn(async () => ({}));
  mockSendMessage = vi.fn(async () => ({ message_id: messageIdCounter++ }));
  const bot = createMockBot();
  const client = createMockOpencodeClient();
  return { bot, client };
}

// --- invalidate tests ---

test("tracks sessions with pending questions", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [{ id: "q1", sessionID: "sess-1", questions: [] }],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("tracks sessions with pending permissions", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({
    data: [permissionRequest],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("tracks sessions with both questions and permissions", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [questionRequest],
  }));
  mockPermissionList = vi.fn(async () => ({
    data: [permissionRequest],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("does not track sessions without pending prompts", async () => {
  const { bot, client } = setup();
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual([]);
});

test("removes session when prompts are resolved", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [questionRequest],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
  mockQuestionList = vi.fn(async () => ({ data: [] }));
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual([]);
});

test("tracks multiple sessions independently", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [
      { ...questionRequest, sessionID: "sess-1" },
      { ...questionRequest, id: "q2", sessionID: "sess-2" },
    ],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session, session2);
  expect(prompts.sessionIds).toEqual(["sess-1", "sess-2"]);
});

test("keeps existing question items that are still on server", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [
      { ...questionRequest, id: "q1" },
      { ...questionRequest, id: "q2" },
    ],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  mockQuestionList = vi.fn(async () => ({
    data: [
      { ...questionRequest, id: "q1" },
      { ...questionRequest, id: "q3" },
    ],
  }));
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("keeps existing permission items that are still on server", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({
    data: [
      { ...permissionRequest, id: "p1" },
      { ...permissionRequest, id: "p2" },
    ],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  mockPermissionList = vi.fn(async () => ({
    data: [
      { ...permissionRequest, id: "p1" },
      { ...permissionRequest, id: "p3" },
    ],
  }));
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("only invalidates given sessions", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [
      { ...questionRequest, sessionID: "sess-1" },
      { ...questionRequest, id: "q2", sessionID: "sess-2" },
    ],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("throws when question list API fails", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    error: new Error("question api down"),
  }));
  using prompts = createPendingPrompts(bot, client);
  await expect(prompts.invalidate(session)).rejects.toThrow(
    "question api down",
  );
});

test("throws when permission list API fails", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({
    error: new Error("permission api down"),
  }));
  using prompts = createPendingPrompts(bot, client);
  await expect(prompts.invalidate(session)).rejects.toThrow(
    "permission api down",
  );
});

test("handles undefined question and permission data", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: undefined }));
  mockPermissionList = vi.fn(async () => ({ data: undefined }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual([]);
});

// --- dismiss tests ---

test("dismiss rejects questions and denies permissions", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
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
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [
      { ...questionRequest, id: "q1" },
      { ...questionRequest, id: "q2" },
    ],
  }));
  mockPermissionList = vi.fn(async () => ({
    data: [
      { ...permissionRequest, id: "p1" },
      { ...permissionRequest, id: "p2" },
    ],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  prompts.dismiss("sess-1");
  expect(mockQuestionReject).toHaveBeenCalledTimes(2);
  expect(mockPermissionReply).toHaveBeenCalledTimes(2);
});

test("dismiss does not edit telegram when items have no message id", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  prompts.dismiss("sess-1");
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("dismiss edits telegram when items have message id", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  prompts.dismiss("sess-1");
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✕ Denied",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("dismiss is no-op for unknown session", async () => {
  const { bot, client } = setup();
  using prompts = createPendingPrompts(bot, client);
  prompts.dismiss("unknown");
  expect(mockQuestionReject).not.toHaveBeenCalled();
  expect(mockPermissionReply).not.toHaveBeenCalled();
});

test("dismiss logs warning on question reject failure", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  const error = new Error("reject failed");
  mockQuestionReject = vi.fn(async () => {
    throw error;
  });
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  prompts.dismiss("sess-1");
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "pending prompt opencode dismiss question failed",
      { sessionId: "sess-1", requestID: "q1" },
      error,
    ),
  );
});

test("dismiss logs warning on permission reply failure", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  const error = new Error("reply failed");
  mockPermissionReply = vi.fn(async () => {
    throw error;
  });
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  prompts.dismiss("sess-1");
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "pending prompt opencode dismiss permission failed",
      { sessionId: "sess-1", requestID: "p1" },
      error,
    ),
  );
});

test("dismiss logs debug message", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  prompts.dismiss("sess-1");
  expect(consola.debug).toHaveBeenCalledWith("pending prompts dismissed", {
    sessionId: "sess-1",
  });
});

test("dispose dismisses all tracked sessions", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [
      { ...questionRequest, sessionID: "sess-1" },
      { ...questionRequest, id: "q2", sessionID: "sess-2" },
    ],
  }));
  {
    using prompts = createPendingPrompts(bot, client);
    await prompts.invalidate(session, session2);
    expect(prompts.sessionIds).toEqual(["sess-1", "sess-2"]);
  }
  expect(mockQuestionReject).toHaveBeenCalledTimes(2);
});

test("dismiss logs warning on grammy edit non-access error", async () => {
  const { bot, client } = setup();
  const error = new Error("network error");
  mockEditMessageText = vi.fn(async () => {
    throw error;
  });
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  prompts.dismiss("sess-1");
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "pending prompt grammy edit failed",
      { chatId: 123, messageId: 100 },
      error,
    ),
  );
});

test("dismiss silences grammy edit access error", async () => {
  const { bot, client } = setup();
  const error = new GrammyError(
    "Call to 'editMessageText' failed! (403: Forbidden: bot was blocked by the user)",
    {
      ok: false,
      error_code: 403,
      description: "Forbidden: bot was blocked by the user",
    },
    "editMessageText",
    {},
  );
  mockEditMessageText = vi.fn(async () => {
    throw error;
  });
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  prompts.dismiss("sess-1");
  await vi.waitFor(() =>
    expect(consola.warn).not.toHaveBeenCalledWith(
      "pending prompt grammy edit failed",
      expect.anything(),
      expect.anything(),
    ),
  );
});

// --- flush tests ---

test("flush sends permission prompt to telegram", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  expect(mockSendMessage).toHaveBeenCalledWith(
    123,
    expect.any(String),
    expect.objectContaining({
      parse_mode: "MarkdownV2",
      reply_markup: expect.any(Object),
    }),
  );
});

test("flush sends question prompt to telegram", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  expect(mockSendMessage).toHaveBeenCalledWith(
    123,
    expect.any(String),
    expect.objectContaining({
      parse_mode: "MarkdownV2",
      reply_markup: expect.any(Object),
    }),
  );
});

test("flush does nothing if a prompt is already active", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({
    data: [
      { ...permissionRequest, id: "p1" },
      { ...permissionRequest, id: "p2" },
    ],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  await prompts.flush();
  // Still only 1 call — second flush was no-op
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("flush does nothing when no items exist", async () => {
  const { bot, client } = setup();
  using prompts = createPendingPrompts(bot, client);
  await prompts.flush();
  expect(mockSendMessage).not.toHaveBeenCalled();
});

test("flush includes thread id when present", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({
    data: [{ ...permissionRequest, sessionID: "sess-2" }],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session2);
  await prompts.flush();
  expect(mockSendMessage).toHaveBeenCalledWith(
    456,
    expect.any(String),
    expect.objectContaining({ message_thread_id: 789 }),
  );
});

// --- answer permission tests ---
// key for first item is "0"

test("answer permission with once calls opencode", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  await prompts.answer("sess-1", "po:0");
  expect(mockPermissionReply).toHaveBeenCalledWith({
    requestID: "p1",
    reply: "once",
  });
  expect(mockEditMessageText).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer permission with always calls opencode", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  await prompts.answer("sess-1", "pa:0");
  expect(mockPermissionReply).toHaveBeenCalledWith({
    requestID: "p1",
    reply: "always",
  });
});

test("answer permission with reject calls opencode", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  await prompts.answer("sess-1", "pr:0");
  expect(mockPermissionReply).toHaveBeenCalledWith({
    requestID: "p1",
    reply: "reject",
  });
});

test("answer permission logs warning on opencode failure", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  const error = new Error("reply failed");
  mockPermissionReply = vi.fn(async () => {
    throw error;
  });
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer("sess-1", "po:0");
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "pending prompt opencode permission reply failed",
      { sessionId: "sess-1", requestID: "p1" },
      error,
    ),
  );
});

// --- answer question reject tests ---

test("answer question with reject calls opencode", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  await prompts.answer("sess-1", "qr:0");
  expect(mockQuestionReject).toHaveBeenCalledWith({ requestID: "q1" });
  expect(mockEditMessageText).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer question reject logs warning on opencode failure", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  const error = new Error("reject failed");
  mockQuestionReject = vi.fn(async () => {
    throw error;
  });
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer("sess-1", "qr:0");
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "pending prompt opencode question reject failed",
      { sessionId: "sess-1", requestID: "q1" },
      error,
    ),
  );
});

// --- answer question select tests ---

test("answer question select single auto-submits", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  await prompts.answer("sess-1", "qt:0:1");
  expect(mockQuestionReply).toHaveBeenCalledWith({
    requestID: "q1",
    answers: [["Claude"]],
  });
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer question select multi toggles selection", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [multiSelectQuestionRequest],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  // Select first option
  await prompts.answer("sess-1", "qt:0:0");
  // Should update keyboard, not submit
  expect(mockQuestionReply).not.toHaveBeenCalled();
  expect(mockEditMessageText).toHaveBeenCalled();
  // Select second option
  await prompts.answer("sess-1", "qt:0:1");
  expect(mockQuestionReply).not.toHaveBeenCalled();
});

test("answer question select multi toggles off", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [multiSelectQuestionRequest],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  await prompts.answer("sess-1", "qt:0:0");
  // Toggle off
  await prompts.answer("sess-1", "qt:0:0");
  // Confirm with empty selection
  await prompts.answer("sess-1", "qc:0");
  expect(mockQuestionReply).toHaveBeenCalledWith({
    requestID: "msq1",
    answers: [[]],
  });
});

test("answer question select invalid index is no-op", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer("sess-1", "qt:0:99");
  expect(mockQuestionReply).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer question select multi logs warning on grammy error", async () => {
  const { bot, client } = setup();
  const error = new Error("edit failed");
  mockEditMessageText = vi.fn(async () => {
    throw error;
  });
  mockQuestionList = vi.fn(async () => ({
    data: [multiSelectQuestionRequest],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  await prompts.answer("sess-1", "qt:0:0");
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "pending prompt grammy select failed",
      { chatId: 123, messageId: 100 },
      error,
    ),
  );
});

test("answer question select multi silences grammy access error", async () => {
  const { bot, client } = setup();
  const error = new GrammyError(
    "Call to 'editMessageText' failed! (403: Forbidden)",
    { ok: false, error_code: 403, description: "Forbidden" },
    "editMessageText",
    {},
  );
  mockEditMessageText = vi.fn(async () => {
    throw error;
  });
  mockQuestionList = vi.fn(async () => ({
    data: [multiSelectQuestionRequest],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  await prompts.answer("sess-1", "qt:0:0");
  await vi.waitFor(() =>
    expect(consola.warn).not.toHaveBeenCalledWith(
      "pending prompt grammy select failed",
      expect.anything(),
      expect.anything(),
    ),
  );
});

// --- answer question confirm tests ---

test("answer question confirm submits selected options", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [multiSelectQuestionRequest],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  await prompts.answer("sess-1", "qt:0:0");
  await prompts.answer("sess-1", "qt:0:2");
  await prompts.answer("sess-1", "qc:0");
  expect(mockQuestionReply).toHaveBeenCalledWith({
    requestID: "msq1",
    answers: [["Auth", "API"]],
  });
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

// --- multi-question advance tests ---

test("answer advances to next question in multi-question", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [multiQuestionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  // Answer first question — should advance, not submit
  await prompts.answer("sess-1", "qt:0:0");
  expect(mockQuestionReply).not.toHaveBeenCalled();
  // Session still tracked
  expect(prompts.sessionIds).toEqual(["sess-1"]);
  // A new sendMessage for the second question
  expect(mockSendMessage).toHaveBeenCalledTimes(2);
  // Answer second question — should submit
  await prompts.answer("sess-1", "qt:0:1");
  expect(mockQuestionReply).toHaveBeenCalledWith({
    requestID: "mq1",
    answers: [["GPT-4"], ["Python"]],
  });
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("advance edits current message with answered text", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [multiQuestionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  await prompts.answer("sess-1", "qt:0:1");
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✓ Claude",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("advance logs warning on opencode question reply failure", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  const error = new Error("reply failed");
  mockQuestionReply = vi.fn(async () => {
    throw error;
  });
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  await prompts.answer("sess-1", "qt:0:0");
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "pending prompt opencode question reply failed",
      { sessionId: "sess-1", requestID: "q1" },
      error,
    ),
  );
});

// --- answer edge cases ---

test("answer is no-op for unknown session", async () => {
  const { bot, client } = setup();
  using prompts = createPendingPrompts(bot, client);
  await prompts.answer("unknown", "po:0");
  expect(mockPermissionReply).not.toHaveBeenCalled();
  expect(mockQuestionReject).not.toHaveBeenCalled();
});

test("answer is no-op for unknown key", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer("sess-1", "po:999");
  expect(mockPermissionReply).not.toHaveBeenCalled();
});

test("answer is no-op for invalid callback format", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer("sess-1", "invalid");
  expect(mockPermissionReply).not.toHaveBeenCalled();
});

test("answer permission ignores invalid prefix", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer("sess-1", "px:0");
  expect(mockPermissionReply).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer question select non-numeric index is no-op", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer("sess-1", "qt:0:abc");
  expect(mockQuestionReply).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer q prefix on permission item is no-op", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer("sess-1", "qt:0:0");
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer p prefix on question item is no-op", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer("sess-1", "po:0");
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer does not remove item from session", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  await prompts.answer("sess-1", "qt:0:0");
  expect(mockQuestionReply).toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

// --- invalidate stale dismiss on telegram ---

test("invalidate dismisses stale items on telegram when they have message id", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  // Server no longer has the permission
  mockPermissionList = vi.fn(async () => ({ data: [] }));
  await prompts.invalidate(session);
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✕ Denied",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("answer select multi without flush skips grammy edit", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [multiSelectQuestionRequest],
  }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  // No flush — messageId is undefined
  await prompts.answer("sess-1", "qt:0:0");
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("invalidate does not grammy edit when stale items have no message id", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  mockQuestionList = vi.fn(async () => ({ data: [] }));
  await prompts.invalidate(session);
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("answer qt select missing index part is no-op", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer("sess-1", "qt:0");
  expect(mockQuestionReply).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

// --- resolve tests ---

test("resolve permission-replied edits telegram and removes item", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  prompts.resolve("sess-1", {
    kind: "permission-replied",
    requestId: "p1",
    reply: "once",
  });
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✓ Allowed (once)",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
  expect(prompts.sessionIds).toEqual([]);
});

test("resolve permission-replied with always", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  prompts.resolve("sess-1", {
    kind: "permission-replied",
    requestId: "p1",
    reply: "always",
  });
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✓ Allowed (always)",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("resolve permission-replied with reject", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  prompts.resolve("sess-1", {
    kind: "permission-replied",
    requestId: "p1",
    reply: "reject",
  });
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✕ Denied",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("resolve question-replied edits telegram and removes item", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  // Select an option first so item.selected has data
  await prompts.answer("sess-1", "qt:0:1");
  prompts.resolve("sess-1", {
    kind: "question-replied",
    requestId: "q1",
  });
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✓ Claude",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
  expect(prompts.sessionIds).toEqual([]);
});

test("resolve question-rejected edits telegram and removes item", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  prompts.resolve("sess-1", {
    kind: "question-rejected",
    requestId: "q1",
  });
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✕ Dismissed",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
  expect(prompts.sessionIds).toEqual([]);
});

test("resolve is no-op for unknown session", () => {
  const { bot, client } = setup();
  using prompts = createPendingPrompts(bot, client);
  prompts.resolve("unknown", {
    kind: "permission-replied",
    requestId: "p1",
    reply: "once",
  });
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("resolve is no-op for unknown request id", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  prompts.resolve("sess-1", {
    kind: "permission-replied",
    requestId: "unknown",
    reply: "once",
  });
  expect(mockEditMessageText).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("resolve skips grammy edit when item has no message id", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  // No flush — no messageId
  prompts.resolve("sess-1", {
    kind: "permission-replied",
    requestId: "p1",
    reply: "once",
  });
  expect(mockEditMessageText).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual([]);
});

test("resolve question result on permission item is no-op", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  prompts.resolve("sess-1", {
    kind: "question-replied",
    requestId: "p1",
  });
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("resolve permission result on question item is no-op", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  prompts.resolve("sess-1", {
    kind: "permission-replied",
    requestId: "q1",
    reply: "once",
  });
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("resolve logs warning on grammy edit non-access error", async () => {
  const { bot, client } = setup();
  const error = new Error("edit failed");
  mockEditMessageText = vi.fn(async () => {
    throw error;
  });
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  prompts.resolve("sess-1", {
    kind: "permission-replied",
    requestId: "p1",
    reply: "once",
  });
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "pending prompt grammy edit failed",
      { chatId: 123, messageId: 100 },
      error,
    ),
  );
});

test("resolve silences grammy edit access error", async () => {
  const { bot, client } = setup();
  const error = new GrammyError(
    "Call to 'editMessageText' failed! (403: Forbidden)",
    { ok: false, error_code: 403, description: "Forbidden" },
    "editMessageText",
    {},
  );
  mockEditMessageText = vi.fn(async () => {
    throw error;
  });
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush();
  prompts.resolve("sess-1", {
    kind: "permission-replied",
    requestId: "p1",
    reply: "once",
  });
  await vi.waitFor(() =>
    expect(consola.warn).not.toHaveBeenCalledWith(
      "pending prompt grammy edit failed",
      expect.anything(),
      expect.anything(),
    ),
  );
});

test("resolve keeps session when other items remain", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  prompts.resolve("sess-1", {
    kind: "question-rejected",
    requestId: "q1",
  });
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});
