import type { PermissionRequest, QuestionRequest } from "@opencode-ai/sdk/v2";
import { GrammyError } from "grammy";
import { expect, test, vi } from "vitest";
import { Errors } from "~/lib/errors";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { PendingPrompts } from "~/lib/pending-prompts";

vi.mock("~/lib/grammy-send-permission-message", () => ({
  grammySendPermissionMessage: vi.fn(async () => {}),
}));

vi.mock("~/lib/grammy-send-permission-pending", () => ({
  grammySendPermissionPending: vi.fn(async () => {}),
}));

vi.mock("~/lib/grammy-send-question-message", () => ({
  grammySendQuestionMessage: vi.fn(async () => {}),
}));

vi.mock("~/lib/grammy-send-question-pending", () => ({
  grammySendQuestionPending: vi.fn(async () => {}),
}));

type MockFn = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

let mockAnswerCallbackQuery: MockFn;
let mockEditMessageText: MockFn;
let mockSendMessage: MockFn;
let mockQuestionReject: MockFn;
let mockQuestionReply: MockFn;
let mockPermissionReply: MockFn;

const noQuestions: readonly QuestionRequest[] = [];
const noPermissions: readonly PermissionRequest[] = [];

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

function createMockExistingSessions(
  map: Record<string, ExistingSessions.Location> = {
    "sess-1": { chatId: 123, threadId: undefined },
    "sess-2": { chatId: 456, threadId: 789 },
  },
) {
  const hooks: Record<string, ((...args: unknown[]) => unknown) | undefined> =
    {};
  return {
    sessionIds: Object.keys(map),
    hook: vi.fn((name: string, fn: (...args: unknown[]) => unknown) => {
      hooks[name] = fn;
      return () => {
        hooks[name] = undefined;
      };
    }),
    findOrCreate: vi.fn(),
    invalidate: vi.fn(),
    check: (sessionId: string) => sessionId in map,
    resolve: (sessionId: string) => map[sessionId],
    hooks,
  } as unknown as ExistingSessions & {
    hooks: typeof hooks;
  };
}

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

function setup(esMap?: Record<string, ExistingSessions.Location>) {
  messageIdCounter = 100;
  mockAnswerCallbackQuery = vi.fn(async () => ({}));
  mockEditMessageText = vi.fn(async () => ({}));
  mockSendMessage = vi.fn(async () => ({ message_id: messageIdCounter++ }));
  const shutdown = { trigger: vi.fn() } as never;
  const bot = createMockBot();
  const client = createMockOpencodeClient();
  const existingSessions = createMockExistingSessions(esMap);
  return { shutdown, bot, client, existingSessions };
}

// --- check tests ---

test("check returns true for session with pending prompts", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  expect(prompts.check("sess-1")).toBe(true);
});

test("check returns false for session without pending prompts", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  expect(prompts.check("sess-1")).toBe(false);
});

// --- check tests (session tracking) ---

test("tracks sessions with pending questions", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);
  expect(prompts.check("sess-1")).toBe(true);
});

test("tracks sessions with pending permissions", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  expect(prompts.check("sess-1")).toBe(true);
});

test("tracks sessions with both questions and permissions", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(
    [questionRequest] as never,
    [permissionRequest] as never,
  );
  expect(prompts.check("sess-1")).toBe(true);
});

test("does not track sessions without pending prompts", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, noPermissions);
  expect(prompts.check("sess-1")).toBe(false);
});

test("removes session when prompts are resolved", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);
  expect(prompts.check("sess-1")).toBe(true);
  await prompts.invalidate(noQuestions, noPermissions);
  expect(prompts.check("sess-1")).toBe(false);
});

test("tracks multiple sessions independently", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(
    [
      { ...questionRequest, sessionID: "sess-1" },
      { ...questionRequest, id: "q2", sessionID: "sess-2" },
    ] as never,
    noPermissions,
  );
  expect(prompts.check("sess-1")).toBe(true);
  expect(prompts.check("sess-2")).toBe(true);
});

// --- invalidate tests ---

test("invalidate with no sessions skips processing", async () => {
  const { shutdown, bot, client, existingSessions } = setup({});
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, noPermissions);
});

test("keeps existing question items that are still on server", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(
    [
      { ...questionRequest, id: "q1" },
      { ...questionRequest, id: "q2" },
    ] as never,
    noPermissions,
  );
  await prompts.invalidate(
    [
      { ...questionRequest, id: "q1" },
      { ...questionRequest, id: "q3" },
    ] as never,
    noPermissions,
  );
  expect(prompts.check("sess-1")).toBe(true);
});

test("keeps existing permission items that are still on server", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [
    { ...permissionRequest, id: "p1" },
    { ...permissionRequest, id: "p2" },
  ] as never);
  await prompts.invalidate(noQuestions, [
    { ...permissionRequest, id: "p1" },
    { ...permissionRequest, id: "p3" },
  ] as never);
  expect(prompts.check("sess-1")).toBe(true);
});

test("only invalidates given sessions", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(
    [
      { ...questionRequest, sessionID: "sess-1" },
      { ...questionRequest, id: "q2", sessionID: "sess-2" },
    ] as never,
    noPermissions,
  );
  expect(prompts.check("sess-1")).toBe(true);
});

test("invalidate sends first item to telegram", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  expect(mockSendMessage).toHaveBeenCalledWith(
    123,
    expect.any(String),
    expect.objectContaining({
      parse_mode: "MarkdownV2",
      reply_markup: expect.any(Object),
    }),
  );
});

test("invalidate sends question prompt to telegram", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);
  expect(mockSendMessage).toHaveBeenCalledWith(
    123,
    expect.any(String),
    expect.objectContaining({
      parse_mode: "MarkdownV2",
      reply_markup: expect.any(Object),
    }),
  );
});

test("invalidate does not flush if a prompt is already active", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [
    { ...permissionRequest, id: "p1" },
    { ...permissionRequest, id: "p2" },
  ] as never);
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  await prompts.invalidate(noQuestions, [
    { ...permissionRequest, id: "p1" },
    { ...permissionRequest, id: "p2" },
  ] as never);
  // Still only 1 call — second invalidate was no-op for flush
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("invalidate throws grammy gone error during flush", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  const error = new GrammyError(
    "Call to 'sendMessage' failed! (403: Forbidden: bot was blocked by the user)",
    {
      ok: false,
      error_code: 403,
      description: "Forbidden: bot was blocked by the user",
    },
    "sendMessage",
    {},
  );
  mockSendMessage = vi.fn(async () => {
    throw error;
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await expect(
    prompts.invalidate(noQuestions, [permissionRequest] as never),
  ).rejects.toBe(error);
});

test("invalidate includes thread id when present", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [
    { ...permissionRequest, sessionID: "sess-2" },
  ] as never);
  expect(mockSendMessage).toHaveBeenCalledWith(
    456,
    expect.any(String),
    expect.objectContaining({ message_thread_id: 789 }),
  );
});

test("invalidate dismisses stale items on telegram when they have message id", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);

  // Server no longer has the permission
  await prompts.invalidate(noQuestions, noPermissions);
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✕ Denied",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("invalidate throws when flush fails with non-gone error", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  mockSendMessage = vi.fn(async () => {
    throw new Error("send failed");
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await expect(
    prompts.invalidate(noQuestions, [permissionRequest] as never),
  ).rejects.toThrow("send failed");
});

test("invalidate edits stale items that were flushed", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);
  await prompts.invalidate(noQuestions, noPermissions);
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✕ Dismissed",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

// --- answer tests ---

test("answer permission with once calls opencode", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);

  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "po:0",
  });
  expect(mockPermissionReply).toHaveBeenCalledWith(
    { requestID: "p1", reply: "once" },
    { throwOnError: true },
  );
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1");
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✓ Allowed (once)",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
  expect(prompts.check("sess-1")).toBe(false);
});

test("answer permission with always calls opencode", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);

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
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);

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

test("answer permission rethrows on opencode failure", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  mockPermissionReply = vi.fn(async () => {
    throw new Error("failed");
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "po:0",
    }),
  ).rejects.toThrow("failed");
});

test("answer question with reject calls opencode", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);

  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qr:0",
  });
  expect(mockQuestionReject).toHaveBeenCalledWith(
    { requestID: "q1" },
    { throwOnError: true },
  );
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✕ Dismissed",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
  expect(prompts.check("sess-1")).toBe(false);
});

test("answer question reject rethrows on opencode failure", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  mockQuestionReject = vi.fn(async () => {
    throw new Error("failed");
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qr:0",
    }),
  ).rejects.toThrow("failed");
});

test("answer question select single auto-submits", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);

  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:1",
  });
  expect(mockQuestionReply).toHaveBeenCalledWith(
    { requestID: "q1", answers: [["Claude"]] },
    { throwOnError: true },
  );
  expect(prompts.check("sess-1")).toBe(false);
});

test("answer question select multi toggles selection", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(
    [multiSelectQuestionRequest] as never,
    noPermissions,
  );

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
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(
    [multiSelectQuestionRequest] as never,
    noPermissions,
  );

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

test("answer question confirm submits selected options", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(
    [multiSelectQuestionRequest] as never,
    noPermissions,
  );

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
  expect(prompts.check("sess-1")).toBe(false);
});

test("answer advances to next question in multi-question", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([multiQuestionRequest] as never, noPermissions);

  // Answer first question — should advance and auto-flush next question
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  expect(mockQuestionReply).not.toHaveBeenCalled();
  expect(prompts.check("sess-1")).toBe(true);
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
  expect(prompts.check("sess-1")).toBe(false);
});

test("advance edits current message with answered text", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([multiQuestionRequest] as never, noPermissions);

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

test("advance rethrows on opencode failure", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  mockQuestionReply = vi.fn(async () => {
    throw new Error("failed");
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);

  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qt:0:0",
    }),
  ).rejects.toThrow("failed");
});

test("answer throws grammy gone error", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([multiQuestionRequest] as never, noPermissions);

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
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qt:0:0",
    }),
  ).rejects.toBe(error);
});

test("answer rethrows opencode not found error without dismissing session", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  const error = { name: "NotFoundError", data: { message: "not found" } };
  mockPermissionReply = vi.fn(async () => {
    throw error;
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "po:0",
    }),
  ).rejects.toBe(error);
  expect(prompts.check("sess-1")).toBe(true);
});

test("answer resolves item and flushes next item", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(
    [questionRequest] as never,
    [permissionRequest] as never,
  );
  // Only first item (question) is flushed
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  // Answer the question — should resolve it and flush the permission
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:1",
  });
  expect(mockSendMessage).toHaveBeenCalledTimes(2);
  expect(prompts.check("sess-1")).toBe(true);
});

test("answer removes item from session", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);

  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  expect(mockQuestionReply).toHaveBeenCalled();
  expect(prompts.check("sess-1")).toBe(false);
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
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
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
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: data,
  });
  expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb1", {
    text: `An error occurred: ${code}`,
  });
});

test("answer question select multi skips grammy edit after flush failure", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  mockSendMessage = vi.fn(async () => {
    throw new Error("send failed");
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await expect(
    prompts.invalidate([multiSelectQuestionRequest] as never, noPermissions),
  ).rejects.toThrow();
  // Flush failed — items have no messageId, toggle should not edit
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "qt:0:0",
  });
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("answer question select multi rethrows on grammy error", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  mockEditMessageText = vi.fn(async () => {
    throw new Error("edit failed");
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(
    [multiSelectQuestionRequest] as never,
    noPermissions,
  );

  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qt:0:0",
    }),
  ).rejects.toThrow("edit failed");
});

test("answer question select multi throws grammy gone error", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  const error = new GrammyError(
    "Call to 'editMessageText' failed! (403: Forbidden)",
    { ok: false, error_code: 403, description: "Forbidden" },
    "editMessageText",
    {},
  );
  mockEditMessageText = vi.fn(async () => {
    throw error;
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(
    [multiSelectQuestionRequest] as never,
    noPermissions,
  );

  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qt:0:0",
    }),
  ).rejects.toBe(error);
});

test("answer throws when answer callback fails", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  mockAnswerCallbackQuery = vi.fn(async () => {
    throw new Error("callback failed");
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
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
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);

  await prompts.answer({ sessionId: "sess-1", text: "my custom answer" });
  expect(mockQuestionReply).toHaveBeenCalledWith(
    { requestID: "q1", answers: [["my custom answer"]] },
    { throwOnError: true },
  );
});

test("answer custom text appends to selected options for multi-select question", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(
    [multiSelectQuestionRequest] as never,
    noPermissions,
  );

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
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([noCustomQuestionRequest] as never, noPermissions);

  await prompts.answer({ sessionId: "sess-1", text: "my text" });
  expect(grammySendQuestionPending).toHaveBeenCalledWith({
    bot,
    chatId: 123,
    threadId: undefined,
  });
  expect(mockQuestionReply).not.toHaveBeenCalled();
});

test("answer custom text sends permission pending when permission is active", async () => {
  const { grammySendPermissionPending } = await import(
    "~/lib/grammy-send-permission-pending"
  );
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);

  await prompts.answer({ sessionId: "sess-1", text: "some text" });
  expect(grammySendPermissionPending).toHaveBeenCalledWith({
    bot,
    chatId: 123,
    threadId: undefined,
  });
  expect(mockPermissionReply).not.toHaveBeenCalled();
});

test("answer custom text throws PendingPrompts.NotFoundError when no active item after flush failure", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  mockSendMessage = vi.fn(async () => {
    throw new Error("send failed");
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await expect(
    prompts.invalidate([questionRequest] as never, noPermissions),
  ).rejects.toThrow();
  // Flush failed — items have no messageId
  await expect(
    prompts.answer({ sessionId: "sess-1", text: "hello" }),
  ).rejects.toThrow(PendingPrompts.NotFoundError);
});

test("answer custom text throws PendingPrompts.NotFoundError for unknown session", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await expect(
    prompts.answer({ sessionId: "unknown", text: "hello" }),
  ).rejects.toThrow(PendingPrompts.NotFoundError);
});

test("answer custom text throws grammy gone error", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([multiQuestionRequest] as never, noPermissions);

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
  await expect(
    prompts.answer({ sessionId: "sess-1", text: "custom" }),
  ).rejects.toBe(error);
});

test("answer custom text rethrows non-gone errors", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  mockQuestionReply = vi.fn(async () => {
    throw new Error("network error");
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);

  await expect(
    prompts.answer({ sessionId: "sess-1", text: "custom" }),
  ).rejects.toThrow("network error");
});

test("answer custom text advances to next question in multi-question request", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([multiQuestionRequest] as never, noPermissions);

  // Answer first question — should advance and auto-flush next question
  await prompts.answer({ sessionId: "sess-1", text: "custom first" });
  expect(mockQuestionReply).not.toHaveBeenCalled();
  // Answer second question — should submit
  await prompts.answer({ sessionId: "sess-1", text: "custom second" });
  expect(mockQuestionReply).toHaveBeenCalledWith(
    { requestID: "mq1", answers: [["custom first"], ["custom second"]] },
    { throwOnError: true },
  );
});

// --- beforeRemove tests ---

test("beforeRemove dismisses and rejects questions and denies permissions", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(
    [questionRequest] as never,
    [permissionRequest] as never,
  );
  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  expect(mockQuestionReject).toHaveBeenCalledWith(
    { requestID: "q1" },
    { throwOnError: true },
  );
  expect(mockPermissionReply).toHaveBeenCalledWith(
    { requestID: "p1", reply: "reject" },
    { throwOnError: true },
  );
  expect(prompts.check("sess-1")).toBe(false);
});

test("beforeRemove handles multiple questions and permissions", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(
    [
      { ...questionRequest, id: "q1" },
      { ...questionRequest, id: "q2" },
    ] as never,
    [
      { ...permissionRequest, id: "p1" },
      { ...permissionRequest, id: "p2" },
    ] as never,
  );
  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  expect(mockQuestionReject).toHaveBeenCalledTimes(2);
  expect(mockPermissionReply).toHaveBeenCalledTimes(2);
});

test("beforeRemove edits telegram when items have message id", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);

  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✕ Denied",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("beforeRemove is no-op for unknown session", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "unknown",
    chatId: 0,
    threadId: undefined,
  });
  expect(mockQuestionReject).not.toHaveBeenCalled();
  expect(mockPermissionReply).not.toHaveBeenCalled();
  expect(prompts.check("unknown")).toBe(false);
});

test("beforeRemove throws on question reject failure", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  mockQuestionReject = vi.fn(async () => {
    throw new Error("reject failed");
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);
  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toThrow("reject failed");
});

test("beforeRemove throws on permission reply failure", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  mockPermissionReply = vi.fn(async () => {
    throw new Error("reply failed");
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toThrow("reply failed");
});

test("beforeRemove throws question reject not found error", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  const error = { name: "NotFoundError", data: { message: "not found" } };
  mockQuestionReject = vi.fn(async () => {
    throw error;
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);
  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toBe(error);
});

test("beforeRemove throws permission reply not found error", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  const error = { name: "NotFoundError", data: { message: "not found" } };
  mockPermissionReply = vi.fn(async () => {
    throw error;
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toBe(error);
});

test("beforeRemove throws on grammy non-gone error", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  mockEditMessageText = vi.fn(async () => {
    throw new Error("network error");
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);

  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toThrow("network error");
});

test("beforeRemove throws grammy gone error", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
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
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);

  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toBe(error);
});

test("dispose dismisses all tracked sessions", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  {
    await using prompts = PendingPrompts.create(
      shutdown,
      bot,
      client,
      existingSessions,
    );
    await prompts.invalidate(
      [
        { ...questionRequest, sessionID: "sess-1" },
        { ...questionRequest, id: "q2", sessionID: "sess-2" },
      ] as never,
      noPermissions,
    );
    expect(prompts.check("sess-1")).toBe(true);
    expect(prompts.check("sess-2")).toBe(true);
  }
  expect(mockQuestionReject).toHaveBeenCalledTimes(2);
});

// --- update tests ---

test("update question.asked adds item and flushes when no active item", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.update({
    type: "question.asked",
    properties: questionRequest as never,
  });
  expect(prompts.check("sess-1")).toBe(true);
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("update question.asked adds item without flushing when item already active", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  await prompts.update({
    type: "question.asked",
    properties: questionRequest as never,
  });
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("update question.asked skips duplicate request ID", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.update({
    type: "question.asked",
    properties: questionRequest as never,
  });
  await prompts.update({
    type: "question.asked",
    properties: questionRequest as never,
  });
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("update permission.asked adds item and flushes when no active item", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.update({
    type: "permission.asked",
    properties: permissionRequest as never,
  });
  expect(prompts.check("sess-1")).toBe(true);
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("update permission.asked adds item without flushing when item already active", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate([questionRequest] as never, noPermissions);
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  await prompts.update({
    type: "permission.asked",
    properties: permissionRequest as never,
  });
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("update permission.asked skips duplicate request ID", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.update({
    type: "permission.asked",
    properties: permissionRequest as never,
  });
  await prompts.update({
    type: "permission.asked",
    properties: permissionRequest as never,
  });
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("update creates new session entry when session not yet in sessionMap", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  expect(prompts.check("sess-1")).toBe(false);
  await prompts.update({
    type: "question.asked",
    properties: { ...questionRequest, sessionID: "sess-2" } as never,
  });
  expect(prompts.check("sess-2")).toBe(true);
  expect(mockSendMessage).toHaveBeenCalledWith(
    456,
    expect.any(String),
    expect.objectContaining({ message_thread_id: 789 }),
  );
});

// --- hook tests ---

test("beforeRemove hook dismisses session", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  expect(prompts.check("sess-1")).toBe(true);
  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  expect(prompts.check("sess-1")).toBe(false);
});

test("dispose unhooks beforeRemove", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts[Symbol.asyncDispose]();
  expect(existingSessions.hooks["beforeRemove"]).toBeUndefined();
});

test("invalidate collects multiple flush errors", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  mockSendMessage = vi.fn(async () => {
    throw new Error("send failed");
  });
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  const perm1 = { ...permissionRequest, sessionID: "sess-1" };
  const perm2 = { ...permissionRequest, id: "p2", sessionID: "sess-2" };
  await expect(
    prompts.invalidate(noQuestions, [perm1, perm2] as never),
  ).rejects.toThrow(Errors);
});

// --- change hook tests ---

test("update fires change hook with pending=true for new session", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await prompts.update({
    type: "permission.asked",
    properties: permissionRequest as never,
  });
  expect(onChange).toHaveBeenCalledWith({
    sessionId: "sess-1",
    pending: true,
  });
});

test("update does not fire change hook for existing session", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await prompts.update({
    type: "permission.asked",
    properties: permissionRequest as never,
  });
  onChange.mockClear();
  await prompts.update({
    type: "question.asked",
    properties: { ...questionRequest, id: "q2" } as never,
  });
  expect(onChange).not.toHaveBeenCalled();
});

test("beforeRemove fires change hook with pending=false", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  onChange.mockClear();
  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  expect(onChange).toHaveBeenCalledWith({
    sessionId: "sess-1",
    pending: false,
  });
});

test("beforeRemove does not fire change hook for unknown session", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "unknown",
    chatId: 0,
    threadId: undefined,
  });
  expect(onChange).not.toHaveBeenCalled();
});

test("invalidate fires change hook with pending=true for new sessions", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  expect(onChange).toHaveBeenCalledWith({
    sessionId: "sess-1",
    pending: true,
  });
});

test("invalidate fires change hook with pending=false when all items removed", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  onChange.mockClear();
  await prompts.invalidate(noQuestions, noPermissions);
  expect(onChange).toHaveBeenCalledWith({
    sessionId: "sess-1",
    pending: false,
  });
});

test("invalidate does not fire change hook when state unchanged", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  onChange.mockClear();
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  expect(onChange).not.toHaveBeenCalled();
});

test("resolving last item fires change hook with pending=false", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  onChange.mockClear();
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: `po:0`,
  });
  expect(onChange).toHaveBeenCalledWith({
    sessionId: "sess-1",
    pending: false,
  });
});

test("resolving non-last item does not fire change hook", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await prompts.invalidate(noQuestions, [
    { ...permissionRequest, id: "p1" },
    { ...permissionRequest, id: "p2" },
  ] as never);
  onChange.mockClear();
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "po:0",
  });
  expect(onChange).not.toHaveBeenCalled();
});

test("change hook errors bubble up from beforeRemove", async () => {
  const { shutdown, bot, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    shutdown,
    bot,
    client,
    existingSessions,
  );
  await prompts.invalidate(noQuestions, [permissionRequest] as never);
  prompts.hook("change", () => {
    throw new Error("hook failed");
  });
  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toThrow();
});
