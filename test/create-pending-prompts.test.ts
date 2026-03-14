import { consola } from "consola";
import { GrammyError } from "grammy";
import { expect, test, vi } from "vitest";
import { createPendingPrompts } from "~/lib/create-pending-prompts";

vi.mock("~/lib/grammy-send-chunks", () => ({
  grammySendChunks: vi.fn(async () => {}),
}));

type MockFn = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

let mockAnswerCallbackQuery: MockFn;
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
      answerCallbackQuery: (...args: unknown[]) =>
        mockAnswerCallbackQuery(...args),
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
        { label: "API", description: "API Gateway" },
      ],
      multiple: true,
    },
  ],
};

let messageIdCounter: number;

function setup() {
  messageIdCounter = 100;
  mockAnswerCallbackQuery = vi.fn(async () => ({}));
  mockEditMessageText = vi.fn(async () => ({}));
  mockSendMessage = vi.fn(async () => ({ message_id: messageIdCounter++ }));
  const bot = createMockBot();
  const client = createMockOpencodeClient();
  return { bot, client };
}

// --- sessionIds tests ---

test("tracks sessions with pending questions", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [{ id: "q1", sessionID: "sess-1", questions: [] }],
  }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("tracks sessions with pending permissions", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({
    data: [permissionRequest],
  }));
  await using prompts = createPendingPrompts(bot, client);
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("does not track sessions without pending prompts", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual([]);
});

test("removes session when prompts are resolved", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [questionRequest],
  }));
  await using prompts = createPendingPrompts(bot, client);
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session, session2);
  expect(prompts.sessionIds).toEqual(["sess-1", "sess-2"]);
});

// --- invalidate tests ---

test("invalidate with no sessions skips API calls", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate();
  expect(mockQuestionList).not.toHaveBeenCalled();
  expect(mockPermissionList).not.toHaveBeenCalled();
});

test("keeps existing question items that are still on server", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [
      { ...questionRequest, id: "q1" },
      { ...questionRequest, id: "q2" },
    ],
  }));
  await using prompts = createPendingPrompts(bot, client);
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
  await using prompts = createPendingPrompts(bot, client);
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("invalidate dismisses stale items on telegram when they have message id", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
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

test("invalidate does not grammy edit when stale items have no message id", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  mockQuestionList = vi.fn(async () => ({ data: [] }));
  await prompts.invalidate(session);
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("handles undefined question and permission data", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: undefined }));
  mockPermissionList = vi.fn(async () => ({ data: undefined }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  expect(prompts.sessionIds).toEqual([]);
});

test("throws when question list API fails", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    error: new Error("question api down"),
  }));
  await using prompts = createPendingPrompts(bot, client);
  await expect(prompts.invalidate(session)).rejects.toThrow(
    "question api down",
  );
});

test("throws when permission list API fails", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({
    error: new Error("permission api down"),
  }));
  await using prompts = createPendingPrompts(bot, client);
  await expect(prompts.invalidate(session)).rejects.toThrow(
    "permission api down",
  );
});

// --- flush tests ---

test("flush sends permission prompt to telegram", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  await prompts.flush("sess-1");
  // Still only 1 call — second flush was no-op
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("flush with no session ids is a no-op", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.flush();
  expect(mockSendMessage).not.toHaveBeenCalled();
});

test("flush does nothing when no items exist", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.flush("sess-1");
  expect(mockSendMessage).not.toHaveBeenCalled();
});

test("flush throws when send message fails", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  mockSendMessage = vi.fn(async () => {
    throw new Error("send failed");
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await expect(prompts.flush("sess-1")).rejects.toThrow("send failed");
});

test("flush includes thread id when present", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({
    data: [{ ...permissionRequest, sessionID: "sess-2" }],
  }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session2);
  await prompts.flush("sess-2");
  expect(mockSendMessage).toHaveBeenCalledWith(
    456,
    expect.any(String),
    expect.objectContaining({ message_thread_id: 789 }),
  );
});

// --- answer tests ---

test("answer permission with once calls opencode", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "po:0",
  });
  expect(mockPermissionReply).toHaveBeenCalledWith({
    requestID: "p1",
    reply: "once",
  });
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", undefined);
  expect(mockEditMessageText).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer permission with always calls opencode", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "pa:0",
  });
  expect(mockPermissionReply).toHaveBeenCalledWith({
    requestID: "p1",
    reply: "always",
  });
});

test("answer permission with reject calls opencode", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "pr:0",
  });
  expect(mockPermissionReply).toHaveBeenCalledWith({
    requestID: "p1",
    reply: "reject",
  });
});

test("answer permission shows error and rethrows on opencode failure", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  const error = new Error("reply failed");
  mockPermissionReply = vi.fn(async () => {
    throw error;
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "po:0",
    }),
  ).rejects.toThrow("reply failed");
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred",
  });
});

test("answer permission shows error and rethrows on opencode result error", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  const error = new Error("result error");
  mockPermissionReply = vi.fn(async () => ({ error }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "po:0",
    }),
  ).rejects.toThrow("result error");
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred",
  });
});

test("answer question with reject calls opencode", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qr:0",
  });
  expect(mockQuestionReject).toHaveBeenCalledWith({ requestID: "q1" });
  expect(mockEditMessageText).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer question reject shows error and rethrows on opencode failure", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  const error = new Error("reject failed");
  mockQuestionReject = vi.fn(async () => {
    throw error;
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qr:0",
    }),
  ).rejects.toThrow("reject failed");
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred",
  });
});

test("answer question reject shows error and rethrows on opencode result error", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  const error = new Error("result error");
  mockQuestionReject = vi.fn(async () => ({ error }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qr:0",
    }),
  ).rejects.toThrow("result error");
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred",
  });
});

test("answer question select single auto-submits", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:1",
  });
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  // Select first option
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  // Should update keyboard, not submit
  expect(mockQuestionReply).not.toHaveBeenCalled();
  expect(mockEditMessageText).toHaveBeenCalled();
  // Select second option
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:1",
  });
  expect(mockQuestionReply).not.toHaveBeenCalled();
});

test("answer question select multi toggles off", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [multiSelectQuestionRequest],
  }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  // Toggle off
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  // Confirm with empty selection
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qc:0",
  });
  expect(mockQuestionReply).toHaveBeenCalledWith({
    requestID: "msq1",
    answers: [[]],
  });
});

test("answer question select multi without flush skips grammy edit", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [multiSelectQuestionRequest],
  }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  // No flush — messageId is undefined
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("answer question confirm submits selected options", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({
    data: [multiSelectQuestionRequest],
  }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:2",
  });
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qc:0",
  });
  expect(mockQuestionReply).toHaveBeenCalledWith({
    requestID: "msq1",
    answers: [["Auth", "API"]],
  });
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer advances to next question in multi-question", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [multiQuestionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  // Answer first question — should advance, not submit
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  expect(mockQuestionReply).not.toHaveBeenCalled();
  // Session still tracked
  expect(prompts.sessionIds).toEqual(["sess-1"]);
  // A new sendMessage for the second question
  expect(mockSendMessage).toHaveBeenCalledTimes(2);
  // Answer second question — should submit
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:1",
  });
  expect(mockQuestionReply).toHaveBeenCalledWith({
    requestID: "mq1",
    answers: [["GPT-4"], ["Python"]],
  });
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("advance edits current message with answered text", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [multiQuestionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:1",
  });
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✓ Claude",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("advance shows error and rethrows on opencode question reply failure", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  const error = new Error("reply failed");
  mockQuestionReply = vi.fn(async () => {
    throw error;
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qt:0:0",
    }),
  ).rejects.toThrow("reply failed");
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred",
  });
});

test("advance shows error and rethrows on opencode question reply result error", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  const error = new Error("result error");
  mockQuestionReply = vi.fn(async () => ({ error }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qt:0:0",
    }),
  ).rejects.toThrow("result error");
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred",
  });
});

test("answer drops session on grammy gone error", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [multiQuestionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  mockEditMessageText = vi.fn(async () => {
    throw new GrammyError(
      "Call to 'editMessageText' failed! (403: Forbidden: bot was blocked by the user)",
      {
        ok: false,
        error_code: 403,
        description: "Forbidden: bot was blocked by the user",
      },
      "editMessageText",
      {},
    );
  });
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  expect(prompts.sessionIds).toEqual([]);
  expect(mockQuestionReject).toHaveBeenCalledWith({ requestID: "mq1" });
});

test("answer dismisses session on opencode gone error", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  mockPermissionReply = vi.fn(async () => ({
    error: { name: "NotFoundError", data: { message: "not found" } },
  }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "po:0",
  });
  expect(prompts.sessionIds).toEqual([]);
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred",
  });
});

test("answer does not remove item from session", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  expect(mockQuestionReply).toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer toasts expired for unknown session", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.answer({
    sessionId: "unknown",
    callbackQueryId: "cb1",
    callbackQueryData: "po:0",
  });
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred: expired_session",
  });
  expect(mockPermissionReply).not.toHaveBeenCalled();
  expect(mockQuestionReject).not.toHaveBeenCalled();
});

test("answer toasts expired for unknown key", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "po:999",
  });
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred: expired_prompt",
  });
  expect(mockPermissionReply).not.toHaveBeenCalled();
});

test("answer toasts invalid for bad callback format", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "invalid",
  });
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred: invalid_format",
  });
  expect(mockPermissionReply).not.toHaveBeenCalled();
});

test("answer toasts invalid for wrong prefix on permission", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "px:0",
  });
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred: invalid_prefix",
  });
  expect(mockPermissionReply).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer toasts invalid for out-of-bounds index", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:99",
  });
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred: invalid_option",
  });
  expect(mockQuestionReply).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer toasts invalid for missing index part", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0",
  });
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred: invalid_index",
  });
  expect(mockQuestionReply).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer toasts invalid for non-numeric index", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:abc",
  });
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred: invalid_index",
  });
  expect(mockQuestionReply).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer toasts invalid for q prefix on permission item", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred: invalid_prefix",
  });
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer toasts invalid for p prefix on question item", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "po:0",
  });
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred: unknown_prefix",
  });
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "pending prompt grammy select failed",
      { sessionId: "sess-1", chatId: 123, messageId: 100 },
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  await vi.waitFor(() =>
    expect(consola.warn).not.toHaveBeenCalledWith(
      "pending prompt grammy select failed",
      expect.anything(),
      expect.anything(),
    ),
  );
});

test("answer logs warning on answer callback non-access error", async () => {
  const { bot, client } = setup();
  const error = new Error("callback failed");
  mockAnswerCallbackQuery = vi.fn(async () => {
    throw error;
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.answer({
    sessionId: "unknown",
    callbackQueryId: "cb1",
    callbackQueryData: "po:0",
  });
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "pending prompt grammy answer callback failed",
      { callbackQueryId: "cb1" },
      error,
    ),
  );
});

test("answer silences answer callback access error", async () => {
  const { bot, client } = setup();
  mockAnswerCallbackQuery = vi.fn(async () => {
    throw new GrammyError(
      "Call to 'answerCallbackQuery' failed! (403: Forbidden)",
      {
        ok: false,
        error_code: 403,
        description: "Forbidden: bot was blocked by the user",
      },
      "answerCallbackQuery",
      {},
    );
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.answer({
    sessionId: "unknown",
    callbackQueryId: "cb1",
    callbackQueryData: "po:0",
  });
  await vi.waitFor(() =>
    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
      text: "An error occurred: expired_session",
    }),
  );
  expect(consola.warn).not.toHaveBeenCalled();
});

// --- resolve tests ---

test("resolve permission-replied edits telegram and removes item", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.resolve("sess-1", {
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.resolve("sess-1", {
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.resolve("sess-1", {
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  // Select an option first so item.selected has data
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:1",
  });
  await prompts.resolve("sess-1", {
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.resolve("sess-1", {
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

test("resolve is no-op for unknown session", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.resolve("unknown", {
    kind: "permission-replied",
    requestId: "p1",
    reply: "once",
  });
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("resolve is no-op for unknown request id", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.resolve("sess-1", {
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  // No flush — no messageId
  await prompts.resolve("sess-1", {
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.resolve("sess-1", {
    kind: "question-replied",
    requestId: "p1",
  });
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("resolve question-rejected on permission item is no-op", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.resolve("sess-1", {
    kind: "question-rejected",
    requestId: "p1",
  });
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("resolve permission result on question item is no-op", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.resolve("sess-1", {
    kind: "permission-replied",
    requestId: "q1",
    reply: "once",
  });
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("resolve throws on grammy edit failure", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  const error = new Error("edit failed");
  mockEditMessageText = vi.fn(async () => {
    throw error;
  });
  await expect(
    prompts.resolve("sess-1", {
      kind: "permission-replied",
      requestId: "p1",
      reply: "once",
    }),
  ).rejects.toThrow("edit failed");
});

test("resolve keeps session when other items remain", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.resolve("sess-1", {
    kind: "question-rejected",
    requestId: "q1",
  });
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

// --- dismiss tests ---

test("dismiss with no session ids is a no-op", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.dismiss();
});

test("dismiss rejects questions and denies permissions", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.dismiss("sess-1");
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.dismiss("sess-1");
  expect(mockQuestionReject).toHaveBeenCalledTimes(2);
  expect(mockPermissionReply).toHaveBeenCalledTimes(2);
});

test("dismiss does not edit telegram when items have no message id", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.dismiss("sess-1");
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("dismiss edits telegram when items have message id", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.dismiss("sess-1");
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✕ Denied",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("dismiss is no-op for unknown session", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.dismiss("unknown");
  expect(mockQuestionReject).not.toHaveBeenCalled();
  expect(mockPermissionReply).not.toHaveBeenCalled();
});

test("dismiss logs warning on question reject failure", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  const error = new Error("reject failed");
  mockQuestionReject = vi.fn(async () => ({ error }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.dismiss("sess-1");
  expect(consola.warn).toHaveBeenCalledWith(
    "pending prompt opencode dismiss failed",
    { sessionId: "sess-1", kind: "question", requestID: "q1" },
    error,
  );
});

test("dismiss logs warning on permission reply failure", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  const error = new Error("reply failed");
  mockPermissionReply = vi.fn(async () => ({ error }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.dismiss("sess-1");
  expect(consola.warn).toHaveBeenCalledWith(
    "pending prompt opencode dismiss failed",
    { sessionId: "sess-1", kind: "permission", requestID: "p1" },
    error,
  );
});

test("dismiss silences question reject not found error", async () => {
  const { bot, client } = setup();
  mockQuestionList = vi.fn(async () => ({ data: [questionRequest] }));
  mockQuestionReject = vi.fn(async () => ({
    error: { name: "NotFoundError", data: { message: "not found" } },
  }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.dismiss("sess-1");
  expect(consola.warn).not.toHaveBeenCalled();
});

test("dismiss silences permission reply not found error", async () => {
  const { bot, client } = setup();
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  mockPermissionReply = vi.fn(async () => ({
    error: { name: "NotFoundError", data: { message: "not found" } },
  }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.dismiss("sess-1");
  expect(consola.warn).not.toHaveBeenCalled();
});

test("dismiss logs warning on grammy dismiss non-access error", async () => {
  const { bot, client } = setup();
  const error = new Error("network error");
  mockEditMessageText = vi.fn(async () => {
    throw error;
  });
  mockPermissionList = vi.fn(async () => ({ data: [permissionRequest] }));
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.dismiss("sess-1");
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "pending prompt grammy dismiss failed",
      { sessionId: "sess-1", chatId: 123, kind: "permission" },
      error,
    ),
  );
});

test("dismiss silences grammy dismiss access error", async () => {
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(session);
  await prompts.flush("sess-1");
  await prompts.dismiss("sess-1");
  expect(consola.warn).not.toHaveBeenCalled();
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
    await using prompts = createPendingPrompts(bot, client);
    await prompts.invalidate(session, session2);
    expect(prompts.sessionIds).toEqual(["sess-1", "sess-2"]);
  }
  expect(mockQuestionReject).toHaveBeenCalledTimes(2);
});
