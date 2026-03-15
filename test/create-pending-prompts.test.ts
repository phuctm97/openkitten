import { consola } from "consola";
import { GrammyError } from "grammy";
import { expect, test, vi } from "vitest";
import { createPendingPrompts } from "~/lib/create-pending-prompts";
import type { OpencodeSnapshot } from "~/lib/opencode-snapshot";
import { PendingPromptFlushError } from "~/lib/pending-prompt-flush-error";
import { PendingPromptNotFoundError } from "~/lib/pending-prompt-not-found-error";

vi.mock("~/lib/grammy-send-chunks", () => ({
  grammySendChunks: vi.fn(async () => {}),
}));

vi.mock("~/lib/grammy-send-question-pending", () => ({
  grammySendQuestionPending: vi.fn(async () => {}),
}));

vi.mock("~/lib/grammy-send-permission-pending", () => ({
  grammySendPermissionPending: vi.fn(async () => {}),
}));

type MockFn = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

let mockAnswerCallbackQuery: MockFn;
let mockEditMessageText: MockFn;
let mockSendMessage: MockFn;
let mockQuestionReject: MockFn;
let mockQuestionReply: MockFn;
let mockPermissionReply: MockFn;

function snapshot({
  questions = [],
  permissions = [],
}: {
  questions?: unknown[];
  permissions?: unknown[];
} = {}): OpencodeSnapshot {
  return { statuses: {}, questions, permissions } as never;
}

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
  mockQuestionReject = vi.fn(async () => ({}));
  mockQuestionReply = vi.fn(async () => ({}));
  mockPermissionReply = vi.fn(async () => ({}));
  return {
    question: {
      reject: (...args: unknown[]) => mockQuestionReject(...args),
      reply: (...args: unknown[]) => mockQuestionReply(...args),
    },
    permission: {
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

const noCustomQuestionRequest = {
  id: "ncq1",
  sessionID: "sess-1",
  questions: [
    {
      question: "Choose a model",
      header: "Model",
      options: [
        { label: "GPT-4", description: "OpenAI GPT-4" },
        { label: "Claude", description: "Anthropic Claude" },
      ],
      custom: false,
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [{ id: "q1", sessionID: "sess-1", questions: [] }] }),
    session,
  );
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("tracks sessions with pending permissions", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("tracks sessions with both questions and permissions", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({
      questions: [questionRequest],
      permissions: [permissionRequest],
    }),
    session,
  );
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("does not track sessions without pending prompts", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot(), session);
  expect(prompts.sessionIds).toEqual([]);
});

test("removes session when prompts are resolved", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
  await prompts.invalidate(snapshot(), session);
  expect(prompts.sessionIds).toEqual([]);
});

test("tracks multiple sessions independently", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({
      questions: [
        { ...questionRequest, sessionID: "sess-1" },
        { ...questionRequest, id: "q2", sessionID: "sess-2" },
      ],
    }),
    session,
    session2,
  );
  expect(prompts.sessionIds).toEqual(["sess-1", "sess-2"]);
});

// --- invalidate tests ---

test("invalidate with no sessions skips processing", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot());
});

test("keeps existing question items that are still on server", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({
      questions: [
        { ...questionRequest, id: "q1" },
        { ...questionRequest, id: "q2" },
      ],
    }),
    session,
  );
  await prompts.invalidate(
    snapshot({
      questions: [
        { ...questionRequest, id: "q1" },
        { ...questionRequest, id: "q3" },
      ],
    }),
    session,
  );
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("keeps existing permission items that are still on server", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({
      permissions: [
        { ...permissionRequest, id: "p1" },
        { ...permissionRequest, id: "p2" },
      ],
    }),
    session,
  );
  await prompts.invalidate(
    snapshot({
      permissions: [
        { ...permissionRequest, id: "p1" },
        { ...permissionRequest, id: "p3" },
      ],
    }),
    session,
  );
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("only invalidates given sessions", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({
      questions: [
        { ...questionRequest, sessionID: "sess-1" },
        { ...questionRequest, id: "q2", sessionID: "sess-2" },
      ],
    }),
    session,
  );
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("invalidate dismisses stale items on telegram when they have message id", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  // Server no longer has the permission
  await prompts.invalidate(snapshot(), session);
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✕ Denied",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("invalidate does not grammy edit when stale items have no message id", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await prompts.invalidate(snapshot(), session);
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

// --- flush tests ---

test("flush sends permission prompt to telegram", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({
      permissions: [
        { ...permissionRequest, id: "p1" },
        { ...permissionRequest, id: "p2" },
      ],
    }),
    session,
  );
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
  mockSendMessage = vi.fn(async () => {
    throw new Error("send failed");
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await expect(prompts.flush("sess-1")).rejects.toThrow(
    PendingPromptFlushError,
  );
  expect(consola.error).toHaveBeenCalledWith(
    "Failed to flush pending prompt",
    expect.objectContaining({ error: expect.any(Error), sessionId: "sess-1" }),
  );
});

test("flush logs all failures and throws with correct count", async () => {
  const { bot, client } = setup();
  mockSendMessage = vi.fn(async () => {
    throw new Error("send failed");
  });
  const permReq2 = { ...permissionRequest, id: "p2", sessionID: "sess-2" };
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest, permReq2] }),
    session,
    session2,
  );
  const error = await prompts
    .flush("sess-1", "sess-2")
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(PendingPromptFlushError);
  expect((error as Error).message).toBe(
    "Pending prompt flush failed: 2 sessions",
  );
  expect(consola.error).toHaveBeenCalledTimes(2);
});

test("flush dismisses session on grammy gone error", async () => {
  const { bot, client } = setup();
  mockSendMessage = vi.fn(async () => {
    throw new GrammyError(
      "Call to 'sendMessage' failed! (403: Forbidden: bot was blocked by the user)",
      {
        ok: false,
        error_code: 403,
        description: "Forbidden: bot was blocked by the user",
      },
      "sendMessage",
      {},
    );
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  expect(prompts.sessionIds).toEqual([]);
});

test("flush includes thread id when present", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [{ ...permissionRequest, sessionID: "sess-2" }] }),
    session2,
  );
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "po:0",
  });
  expect(mockPermissionReply).toHaveBeenCalledWith(
    { requestID: "p1", reply: "once" },
    { throwOnError: true },
  );
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", undefined);
  expect(mockEditMessageText).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer permission with always calls opencode", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "pa:0",
  });
  expect(mockPermissionReply).toHaveBeenCalledWith(
    { requestID: "p1", reply: "always" },
    { throwOnError: true },
  );
});

test("answer permission with reject calls opencode", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "pr:0",
  });
  expect(mockPermissionReply).toHaveBeenCalledWith(
    { requestID: "p1", reply: "reject" },
    { throwOnError: true },
  );
});

test("answer permission shows error and rethrows on opencode failure", async () => {
  const { bot, client } = setup();
  mockPermissionReply = vi.fn(async () => {
    throw new Error("failed");
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "po:0",
    }),
  ).rejects.toThrow("failed");
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred",
  });
});

test("answer question with reject calls opencode", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qr:0",
  });
  expect(mockQuestionReject).toHaveBeenCalledWith(
    { requestID: "q1" },
    { throwOnError: true },
  );
  expect(mockEditMessageText).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer question reject shows error and rethrows on opencode failure", async () => {
  const { bot, client } = setup();
  mockQuestionReject = vi.fn(async () => {
    throw new Error("failed");
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qr:0",
    }),
  ).rejects.toThrow("failed");
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred",
  });
});

test("answer question select single auto-submits", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:1",
  });
  expect(mockQuestionReply).toHaveBeenCalledWith(
    { requestID: "q1", answers: [["Claude"]] },
    { throwOnError: true },
  );
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer question select multi toggles selection", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [multiSelectQuestionRequest] }),
    session,
  );
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [multiSelectQuestionRequest] }),
    session,
  );
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
  expect(mockQuestionReply).toHaveBeenCalledWith(
    { requestID: "msq1", answers: [[]] },
    { throwOnError: true },
  );
});

test("answer question select multi without flush skips grammy edit", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [multiSelectQuestionRequest] }),
    session,
  );
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [multiSelectQuestionRequest] }),
    session,
  );
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
  expect(mockQuestionReply).toHaveBeenCalledWith(
    { requestID: "msq1", answers: [["Auth", "API"]] },
    { throwOnError: true },
  );
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("answer advances to next question in multi-question", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [multiQuestionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  // Answer first question — should advance, not submit or flush
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  expect(mockQuestionReply).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  // Flush to show second question
  await prompts.flush("sess-1");
  expect(mockSendMessage).toHaveBeenCalledTimes(2);
  // Answer second question — should submit
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:1",
  });
  expect(mockQuestionReply).toHaveBeenCalledWith(
    { requestID: "mq1", answers: [["GPT-4"], ["Python"]] },
    { throwOnError: true },
  );
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("advance edits current message with answered text", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [multiQuestionRequest] }),
    session,
  );
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

test("advance shows error and rethrows on opencode failure", async () => {
  const { bot, client } = setup();
  mockQuestionReply = vi.fn(async () => {
    throw new Error("failed");
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await prompts.flush("sess-1");
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qt:0:0",
    }),
  ).rejects.toThrow("failed");
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred",
  });
});

test("answer drops session on grammy gone error", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [multiQuestionRequest] }),
    session,
  );
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
  expect(mockQuestionReject).toHaveBeenCalledWith(
    { requestID: "mq1" },
    { throwOnError: true },
  );
});

test("answer rethrows opencode not found error without dismissing session", async () => {
  const { bot, client } = setup();
  const error = { name: "NotFoundError", data: { message: "not found" } };
  mockPermissionReply = vi.fn(async () => {
    throw error;
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "po:0",
    }),
  ).rejects.toBe(error);
  expect(prompts.sessionIds).toEqual(["sess-1"]);
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred",
  });
});

test("answer does not remove item from session", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  expect(mockQuestionReply).toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test.each([
  {
    desc: "expired for unknown session",
    data: "po:0",
    code: "expired_session",
  },
  { desc: "expired for unknown key", data: "po:999", code: "expired_prompt" },
  {
    desc: "invalid for bad callback format",
    data: "invalid",
    code: "invalid_format",
  },
  {
    desc: "invalid for wrong prefix on permission",
    data: "px:0",
    code: "invalid_prefix",
  },
  {
    desc: "invalid for q prefix on permission item",
    data: "qt:0:0",
    code: "invalid_prefix",
  },
])("answer toasts $desc (permission item)", async ({ data, code }) => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.answer({
    sessionId: code === "expired_session" ? "unknown" : "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: data,
  });
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: `An error occurred: ${code}`,
  });
});

test.each([
  {
    desc: "invalid for out-of-bounds index",
    data: "qt:0:99",
    code: "invalid_option",
  },
  {
    desc: "invalid for missing index part",
    data: "qt:0",
    code: "invalid_index",
  },
  {
    desc: "invalid for non-numeric index",
    data: "qt:0:abc",
    code: "invalid_index",
  },
  {
    desc: "invalid for p prefix on question item",
    data: "po:0",
    code: "unknown_prefix",
  },
])("answer toasts $desc (question item)", async ({ data, code }) => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: data,
  });
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: `An error occurred: ${code}`,
  });
});

test("answer question select multi rethrows on grammy error", async () => {
  const { bot, client } = setup();
  mockEditMessageText = vi.fn(async () => {
    throw new Error("edit failed");
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [multiSelectQuestionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qt:0:0",
    }),
  ).rejects.toThrow("edit failed");
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: "An error occurred",
  });
});

test("answer question select multi dismisses on grammy gone error", async () => {
  const { bot, client } = setup();
  mockEditMessageText = vi.fn(async () => {
    throw new GrammyError(
      "Call to 'editMessageText' failed! (403: Forbidden)",
      { ok: false, error_code: 403, description: "Forbidden" },
      "editMessageText",
      {},
    );
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [multiSelectQuestionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  expect(prompts.sessionIds).toEqual([]);
});

test("answer throws when answer callback fails", async () => {
  const { bot, client } = setup();
  mockAnswerCallbackQuery = vi.fn(async () => {
    throw new Error("callback failed");
  });
  await using prompts = createPendingPrompts(bot, client);
  await expect(
    prompts.answer({
      sessionId: "unknown",
      callbackQueryId: "cb1",
      callbackQueryData: "po:0",
    }),
  ).rejects.toThrow("callback failed");
});

// --- answer custom text tests ---

test("answer custom text submits text as answer for single-select question", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await prompts.flush("sess-1");
  await prompts.answer({ sessionId: "sess-1", text: "my custom answer" });
  expect(mockQuestionReply).toHaveBeenCalledWith(
    { requestID: "q1", answers: [["my custom answer"]] },
    { throwOnError: true },
  );
});

test("answer custom text appends to selected options for multi-select question", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [multiSelectQuestionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  await prompts.answer({ sessionId: "sess-1", text: "custom" });
  expect(mockQuestionReply).toHaveBeenCalledWith(
    { requestID: "msq1", answers: [["Auth", "custom"]] },
    { throwOnError: true },
  );
});

test("answer custom text sends question pending when custom is false", async () => {
  const { grammySendQuestionPending } = await import(
    "~/lib/grammy-send-question-pending"
  );
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [noCustomQuestionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await prompts.answer({ sessionId: "sess-1", text: "my text" });
  expect(grammySendQuestionPending).toHaveBeenCalledWith({
    bot,
    ignoreErrors: false,
    chatId: 123,
    threadId: undefined,
  });
  expect(mockQuestionReply).not.toHaveBeenCalled();
});

test("answer custom text sends permission pending when permission is active", async () => {
  const { grammySendPermissionPending } = await import(
    "~/lib/grammy-send-permission-pending"
  );
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await prompts.answer({ sessionId: "sess-1", text: "some text" });
  expect(grammySendPermissionPending).toHaveBeenCalledWith({
    bot,
    ignoreErrors: false,
    chatId: 123,
    threadId: undefined,
  });
  expect(mockPermissionReply).not.toHaveBeenCalled();
});

test("answer custom text throws PendingPromptNotFoundError for unknown session", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await expect(
    prompts.answer({ sessionId: "unknown", text: "hello" }),
  ).rejects.toThrow(PendingPromptNotFoundError);
});

test("answer custom text throws PendingPromptNotFoundError when no active item", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  // No flush — no messageId set
  await expect(
    prompts.answer({ sessionId: "sess-1", text: "hello" }),
  ).rejects.toThrow(PendingPromptNotFoundError);
});

test("answer custom text dismisses session on grammy gone error", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [multiQuestionRequest] }),
    session,
  );
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
  await prompts.answer({ sessionId: "sess-1", text: "custom" });
  expect(prompts.sessionIds).toEqual([]);
});

test("answer custom text rethrows non-gone errors", async () => {
  const { bot, client } = setup();
  mockQuestionReply = vi.fn(async () => {
    throw new Error("network error");
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await prompts.flush("sess-1");
  await expect(
    prompts.answer({ sessionId: "sess-1", text: "custom" }),
  ).rejects.toThrow("network error");
});

test("answer custom text advances to next question in multi-question request", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ questions: [multiQuestionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await prompts.answer({ sessionId: "sess-1", text: "custom first" });
  expect(mockQuestionReply).not.toHaveBeenCalled();
  // Flush to show second question
  await prompts.flush("sess-1");
  await prompts.answer({ sessionId: "sess-1", text: "custom second" });
  expect(mockQuestionReply).toHaveBeenCalledWith(
    { requestID: "mq1", answers: [["custom first"], ["custom second"]] },
    { throwOnError: true },
  );
});

// --- resolve tests ---

test("resolve permission-replied edits telegram and removes item", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await prompts.resolve({
    sessionId: "sess-1",
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await prompts.resolve({
    sessionId: "sess-1",
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await prompts.resolve({
    sessionId: "sess-1",
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await prompts.flush("sess-1");
  // Select an option first so item.selected has data
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:1",
  });
  await prompts.resolve({
    sessionId: "sess-1",
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await prompts.flush("sess-1");
  await prompts.resolve({
    sessionId: "sess-1",
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
  await prompts.resolve({
    sessionId: "unknown",
    kind: "permission-replied",
    requestId: "p1",
    reply: "once",
  });
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("resolve is no-op for unknown request id", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.resolve({
    sessionId: "sess-1",
    kind: "permission-replied",
    requestId: "unknown",
    reply: "once",
  });
  expect(mockEditMessageText).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual(["sess-1"]);
});

test("resolve skips grammy edit when item has no message id", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  // No flush — no messageId
  await prompts.resolve({
    sessionId: "sess-1",
    kind: "permission-replied",
    requestId: "p1",
    reply: "once",
  });
  expect(mockEditMessageText).not.toHaveBeenCalled();
  expect(prompts.sessionIds).toEqual([]);
});

test("resolve throws on question result for permission item", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await expect(
    prompts.resolve({
      sessionId: "sess-1",
      kind: "question-replied",
      requestId: "p1",
    }),
  ).rejects.toThrow("question result on permission item");
});

test("resolve throws on question-rejected for permission item", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await expect(
    prompts.resolve({
      sessionId: "sess-1",
      kind: "question-rejected",
      requestId: "p1",
    }),
  ).rejects.toThrow("question result on permission item");
});

test("resolve throws on permission result for question item", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await expect(
    prompts.resolve({
      sessionId: "sess-1",
      kind: "permission-replied",
      requestId: "q1",
      reply: "once",
    }),
  ).rejects.toThrow("permission result on question item");
});

test("resolve throws on grammy edit failure", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  const error = new Error("edit failed");
  mockEditMessageText = vi.fn(async () => {
    throw error;
  });
  await expect(
    prompts.resolve({
      sessionId: "sess-1",
      kind: "permission-replied",
      requestId: "p1",
      reply: "once",
    }),
  ).rejects.toThrow("edit failed");
});

test("resolve dismisses session on grammy gone error", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
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
  await prompts.resolve({
    sessionId: "sess-1",
    kind: "permission-replied",
    requestId: "p1",
    reply: "once",
  });
  expect(prompts.sessionIds).toEqual([]);
});

test("resolve keeps session when other items remain", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({
      questions: [questionRequest],
      permissions: [permissionRequest],
    }),
    session,
  );
  await prompts.resolve({
    sessionId: "sess-1",
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({
      questions: [questionRequest],
      permissions: [permissionRequest],
    }),
    session,
  );
  await prompts.dismiss("sess-1");
  expect(mockQuestionReject).toHaveBeenCalledWith(
    { requestID: "q1" },
    { throwOnError: true },
  );
  expect(mockPermissionReply).toHaveBeenCalledWith(
    { requestID: "p1", reply: "reject" },
    { throwOnError: true },
  );
  expect(prompts.sessionIds).toEqual([]);
});

test("dismiss handles multiple questions and permissions", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({
      questions: [
        { ...questionRequest, id: "q1" },
        { ...questionRequest, id: "q2" },
      ],
      permissions: [
        { ...permissionRequest, id: "p1" },
        { ...permissionRequest, id: "p2" },
      ],
    }),
    session,
  );
  await prompts.dismiss("sess-1");
  expect(mockQuestionReject).toHaveBeenCalledTimes(2);
  expect(mockPermissionReply).toHaveBeenCalledTimes(2);
});

test("dismiss does not edit telegram when items have no message id", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await prompts.dismiss("sess-1");
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("dismiss edits telegram when items have message id", async () => {
  const { bot, client } = setup();
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
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
  const error = new Error("reject failed");
  mockQuestionReject = vi.fn(async () => {
    throw error;
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await prompts.dismiss("sess-1");
  expect(consola.warn).toHaveBeenCalledWith(
    "Failed to dismiss pending prompt in OpenCode",
    {
      error,
      kind: "question",
      sessionId: "sess-1",
      chatId: 123,
      requestId: "q1",
    },
  );
});

test("dismiss logs warning on permission reply failure", async () => {
  const { bot, client } = setup();
  const error = new Error("reply failed");
  mockPermissionReply = vi.fn(async () => {
    throw error;
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.dismiss("sess-1");
  expect(consola.warn).toHaveBeenCalledWith(
    "Failed to dismiss pending prompt in OpenCode",
    {
      error,
      kind: "permission",
      sessionId: "sess-1",
      chatId: 123,
      requestId: "p1",
    },
  );
});

test("dismiss silences question reject not found error", async () => {
  const { bot, client } = setup();
  mockQuestionReject = vi.fn(async () => {
    throw { name: "NotFoundError", data: { message: "not found" } };
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(snapshot({ questions: [questionRequest] }), session);
  await prompts.dismiss("sess-1");
  expect(consola.warn).not.toHaveBeenCalled();
});

test("dismiss silences permission reply not found error", async () => {
  const { bot, client } = setup();
  mockPermissionReply = vi.fn(async () => {
    throw { name: "NotFoundError", data: { message: "not found" } };
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.dismiss("sess-1");
  expect(consola.warn).not.toHaveBeenCalled();
});

test("dismiss logs warning on grammy dismiss non-gone error", async () => {
  const { bot, client } = setup();
  const error = new Error("network error");
  mockEditMessageText = vi.fn(async () => {
    throw error;
  });
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await prompts.dismiss("sess-1");
  await vi.waitFor(() =>
    expect(consola.warn).toHaveBeenCalledWith(
      "Failed to dismiss pending prompt in Telegram",
      {
        error,
        kind: "permission",
        sessionId: "sess-1",
        chatId: 123,
        messageId: 100,
      },
    ),
  );
});

test("dismiss silences grammy dismiss gone error", async () => {
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
  await using prompts = createPendingPrompts(bot, client);
  await prompts.invalidate(
    snapshot({ permissions: [permissionRequest] }),
    session,
  );
  await prompts.flush("sess-1");
  await prompts.dismiss("sess-1");
  expect(consola.warn).not.toHaveBeenCalled();
});

test("dispose dismisses all tracked sessions", async () => {
  const { bot, client } = setup();
  {
    await using prompts = createPendingPrompts(bot, client);
    await prompts.invalidate(
      snapshot({
        questions: [
          { ...questionRequest, sessionID: "sess-1" },
          { ...questionRequest, id: "q2", sessionID: "sess-2" },
        ],
      }),
      session,
      session2,
    );
    expect(prompts.sessionIds).toEqual(["sess-1", "sess-2"]);
  }
  expect(mockQuestionReject).toHaveBeenCalledTimes(2);
});
