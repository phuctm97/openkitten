import { GrammyError } from "grammy";
import { expect, test, vi } from "vitest";
import { ExistingSessions } from "~/lib/existing-sessions";
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

vi.mock("~/lib/opencode-resolve-root-session-id", () => ({
  opencodeResolveRootSessionId: vi.fn(
    async (_client: unknown, id: string) => id,
  ),
}));

type MockFn = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

let mockAnswerCallbackQuery: MockFn;
let mockEditMessageText: MockFn;
let mockSendMessage: MockFn;
let mockQuestionReject: MockFn;
let mockQuestionReply: MockFn;
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
    find: vi.fn(),
    check: (sessionId: string) => sessionId in map,
    get: (sessionId: string, options: ExistingSessions.GetOptions = {}) => {
      const location = map[sessionId];
      if (!location && options.unsafe) {
        throw new ExistingSessions.NotFoundError(sessionId);
      }
      return location;
    },
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
  const bot = createMockBot();
  const shutdown = { trigger: vi.fn() } as never;
  const client = createMockOpencodeClient();
  const existingSessions = createMockExistingSessions(esMap);
  return { bot, shutdown, client, existingSessions };
}

async function askPermission(
  prompts: PendingPrompts,
  request: typeof permissionRequest = permissionRequest,
) {
  await prompts.update({
    type: "permission.asked",
    properties: request as never,
  });
}

async function askQuestion(
  prompts: PendingPrompts,
  request:
    | typeof questionRequest
    | typeof multiQuestionRequest
    | typeof multiSelectQuestionRequest
    | typeof noCustomQuestionRequest = questionRequest,
) {
  await prompts.update({
    type: "question.asked",
    properties: request as never,
  });
}

// --- basic state tests ---

test("check returns true for session with pending prompts", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
  expect(prompts.check("sess-1")).toBe(true);
});

test("check returns false for session without pending prompts", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  expect(prompts.check("sess-1")).toBe(false);
});

test("tracks multiple sessions independently", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, questionRequest);
  await askQuestion(prompts, {
    ...questionRequest,
    id: "q2",
    sessionID: "sess-2",
  });
  expect(prompts.check("sess-1")).toBe(true);
  expect(prompts.check("sess-2")).toBe(true);
});

test("question.asked sends a prompt to telegram", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);
  expect(mockSendMessage).toHaveBeenCalledWith(
    123,
    expect.any(String),
    expect.objectContaining({
      parse_mode: "MarkdownV2",
      reply_markup: expect.any(Object),
    }),
  );
});

test("permission.asked includes thread id when present", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts, { ...permissionRequest, sessionID: "sess-2" });
  expect(mockSendMessage).toHaveBeenCalledWith(
    456,
    expect.any(String),
    expect.objectContaining({ message_thread_id: 789 }),
  );
});

test("does not flush a second prompt while another one is active", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts, permissionRequest);
  await askPermission(prompts, { ...permissionRequest, id: "p2" });
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("asked events bubble up grammy gone errors during flush", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
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
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await expect(askPermission(prompts)).rejects.toBe(error);
});

test("asked events bubble up non-gone flush errors", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  mockSendMessage = vi.fn(async () => {
    throw new Error("send failed");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await expect(askPermission(prompts)).rejects.toThrow("send failed");
});

// --- answer tests ---

test("answer permission with once calls opencode", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);

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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);

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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);

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
  const { bot, shutdown, client, existingSessions } = setup();
  mockPermissionReply = vi.fn(async () => {
    throw new Error("failed");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "po:0",
    }),
  ).rejects.toThrow("failed");
});

test("answer question with reject calls opencode", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);

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
  const { bot, shutdown, client, existingSessions } = setup();
  mockQuestionReject = vi.fn(async () => {
    throw new Error("failed");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);
  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qr:0",
    }),
  ).rejects.toThrow("failed");
});

test("answer question select single auto-submits", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);

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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, multiSelectQuestionRequest);

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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, multiSelectQuestionRequest);

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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, multiSelectQuestionRequest);

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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, multiQuestionRequest);

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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, multiQuestionRequest);

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
  const { bot, shutdown, client, existingSessions } = setup();
  mockQuestionReply = vi.fn(async () => {
    throw new Error("failed");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);

  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qt:0:0",
    }),
  ).rejects.toThrow("failed");
});

test("answer throws grammy gone error", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, multiQuestionRequest);

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
  const { bot, shutdown, client, existingSessions } = setup();
  const error = { name: "NotFoundError", data: { message: "not found" } };
  mockPermissionReply = vi.fn(async () => {
    throw error;
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);
  await askPermission(prompts);
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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);

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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);
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
  const { bot, shutdown, client, existingSessions } = setup();
  mockSendMessage = vi.fn(async () => {
    throw new Error("send failed");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await expect(
    askQuestion(prompts, multiSelectQuestionRequest),
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
  const { bot, shutdown, client, existingSessions } = setup();
  mockEditMessageText = vi.fn(async () => {
    throw new Error("edit failed");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, multiSelectQuestionRequest);

  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qt:0:0",
    }),
  ).rejects.toThrow("edit failed");
});

test("answer question select multi throws grammy gone error", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
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
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, multiSelectQuestionRequest);

  await expect(
    prompts.answer({
      sessionId: "sess-1",
      callbackQueryId: "cb1",
      callbackQueryData: "qt:0:0",
    }),
  ).rejects.toBe(error);
});

test("answer throws when answer callback fails", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  mockAnswerCallbackQuery = vi.fn(async () => {
    throw new Error("callback failed");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);

  await prompts.answer({ sessionId: "sess-1", text: "my custom answer" });
  expect(mockQuestionReply).toHaveBeenCalledWith(
    { requestID: "q1", answers: [["my custom answer"]] },
    { throwOnError: true },
  );
});

test("answer custom text appends to selected options for multi-select question", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, multiSelectQuestionRequest);

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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, noCustomQuestionRequest);

  await prompts.answer({
    sessionId: "sess-1",
    messageId: 42,
    text: "my text",
  });
  expect(grammySendQuestionPending).toHaveBeenCalledWith({
    bot,
    chatId: 123,
    threadId: undefined,
    replyToMessageId: 42,
  });
  expect(mockQuestionReply).not.toHaveBeenCalled();
});

test("answer custom text sends permission pending when permission is active", async () => {
  const { grammySendPermissionPending } = await import(
    "~/lib/grammy-send-permission-pending"
  );
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);

  await prompts.answer({
    sessionId: "sess-1",
    messageId: 99,
    text: "some text",
  });
  expect(grammySendPermissionPending).toHaveBeenCalledWith({
    bot,
    chatId: 123,
    threadId: undefined,
    replyToMessageId: 99,
  });
  expect(mockPermissionReply).not.toHaveBeenCalled();
});

test("protect sends question pending when a question is active", async () => {
  const { grammySendQuestionPending } = await import(
    "~/lib/grammy-send-question-pending"
  );
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);

  await prompts.protect({
    sessionId: "sess-1",
    messageId: 17,
  });

  expect(grammySendQuestionPending).toHaveBeenCalledWith({
    bot,
    chatId: 123,
    threadId: undefined,
    replyToMessageId: 17,
  });
});

test("protect sends permission pending when a permission is active", async () => {
  const { grammySendPermissionPending } = await import(
    "~/lib/grammy-send-permission-pending"
  );
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);

  await prompts.protect({
    sessionId: "sess-1",
    messageId: 18,
  });

  expect(grammySendPermissionPending).toHaveBeenCalledWith({
    bot,
    chatId: 123,
    threadId: undefined,
    replyToMessageId: 18,
  });
});

test("protect throws PendingPrompts.NotFoundError when no active item after flush failure", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  mockSendMessage = vi.fn(async () => {
    throw new Error("send failed");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await expect(askQuestion(prompts)).rejects.toThrow();

  await expect(prompts.protect({ sessionId: "sess-1" })).rejects.toThrow(
    PendingPrompts.NotFoundError,
  );
});

test("protect throws PendingPrompts.NotFoundError for unknown session", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );

  await expect(prompts.protect({ sessionId: "unknown" })).rejects.toThrow(
    PendingPrompts.NotFoundError,
  );
});

test("answer custom text throws PendingPrompts.NotFoundError when no active item after flush failure", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  mockSendMessage = vi.fn(async () => {
    throw new Error("send failed");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await expect(askQuestion(prompts)).rejects.toThrow();
  // Flush failed — items have no messageId
  await expect(
    prompts.answer({ sessionId: "sess-1", text: "hello" }),
  ).rejects.toThrow(PendingPrompts.NotFoundError);
});

test("answer custom text throws PendingPrompts.NotFoundError for unknown session", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await expect(
    prompts.answer({ sessionId: "unknown", text: "hello" }),
  ).rejects.toThrow(PendingPrompts.NotFoundError);
});

test("answer custom text throws grammy gone error", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, multiQuestionRequest);

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
  const { bot, shutdown, client, existingSessions } = setup();
  mockQuestionReply = vi.fn(async () => {
    throw new Error("network error");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);

  await expect(
    prompts.answer({ sessionId: "sess-1", text: "custom" }),
  ).rejects.toThrow("network error");
});

test("answer custom text advances to next question in multi-question request", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, multiQuestionRequest);

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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);
  await askPermission(prompts);
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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, { ...questionRequest, id: "q1" });
  await askQuestion(prompts, { ...questionRequest, id: "q2" });
  await askPermission(prompts, { ...permissionRequest, id: "p1" });
  await askPermission(prompts, { ...permissionRequest, id: "p2" });
  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  expect(mockQuestionReject).toHaveBeenCalledTimes(2);
  expect(mockPermissionReply).toHaveBeenCalledTimes(2);
});

test("beforeRemove edits telegram when items have message id", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);

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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
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
  const { bot, shutdown, client, existingSessions } = setup();
  mockQuestionReject = vi.fn(async () => {
    throw new Error("reject failed");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);
  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toThrow("reject failed");
});

test("beforeRemove throws on permission reply failure", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  mockPermissionReply = vi.fn(async () => {
    throw new Error("reply failed");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toThrow("reply failed");
});

test("beforeRemove throws question reject not found error", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  const error = { name: "NotFoundError", data: { message: "not found" } };
  mockQuestionReject = vi.fn(async () => {
    throw error;
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);
  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toBe(error);
});

test("beforeRemove throws permission reply not found error", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  const error = { name: "NotFoundError", data: { message: "not found" } };
  mockPermissionReply = vi.fn(async () => {
    throw error;
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toBe(error);
});

test("beforeRemove throws on grammy non-gone error", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  mockEditMessageText = vi.fn(async () => {
    throw new Error("network error");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);

  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toThrow("network error");
});

test("beforeRemove throws grammy gone error", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
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
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);

  await expect(
    existingSessions.hooks["beforeRemove"]?.({
      sessionId: "sess-1",
      chatId: 123,
      threadId: undefined,
    }),
  ).rejects.toBe(error);
});

test("dispose dismisses all tracked sessions", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  {
    await using prompts = PendingPrompts.create(
      bot,
      shutdown,
      client,
      existingSessions,
    );
    await askQuestion(prompts, { ...questionRequest, sessionID: "sess-1" });
    await askQuestion(prompts, {
      ...questionRequest,
      id: "q2",
      sessionID: "sess-2",
    });
    expect(prompts.check("sess-1")).toBe(true);
    expect(prompts.check("sess-2")).toBe(true);
  }
  expect(mockQuestionReject).toHaveBeenCalledTimes(2);
});

// --- update tests ---

test("update question.asked adds item and flushes when no active item", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  await prompts.update({
    type: "question.asked",
    properties: questionRequest as never,
  });
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("update question.asked skips duplicate request ID", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  await prompts.update({
    type: "permission.asked",
    properties: permissionRequest as never,
  });
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("update permission.asked skips duplicate request ID", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
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

test("update creates new session entry when session not yet in sessionItems", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
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

test("update question.asked skips removed sessions", async () => {
  const { bot, shutdown, client, existingSessions } = setup({});
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await prompts.update({
    type: "question.asked",
    properties: questionRequest as never,
  });
  expect(prompts.check("sess-1")).toBe(false);
  expect(mockSendMessage).not.toHaveBeenCalled();
});

test("update permission.asked skips removed sessions", async () => {
  const { bot, shutdown, client, existingSessions } = setup({});
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await prompts.update({
    type: "permission.asked",
    properties: permissionRequest as never,
  });
  expect(prompts.check("sess-1")).toBe(false);
  expect(mockSendMessage).not.toHaveBeenCalled();
});

// --- hook tests ---

test("beforeRemove hook dismisses session", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
  expect(prompts.check("sess-1")).toBe(true);
  await existingSessions.hooks["beforeRemove"]?.({
    sessionId: "sess-1",
    chatId: 123,
    threadId: undefined,
  });
  expect(prompts.check("sess-1")).toBe(false);
});

test("dispose unhooks beforeRemove", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await prompts[Symbol.asyncDispose]();
  expect(existingSessions.hooks["beforeRemove"]).toBeUndefined();
});

test("multiple asked events surface flush failures", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  mockSendMessage = vi.fn(async () => {
    throw new Error("send failed");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await expect(
    Promise.all([
      askPermission(prompts, { ...permissionRequest, sessionID: "sess-1" }),
      askPermission(prompts, {
        ...permissionRequest,
        id: "p2",
        sessionID: "sess-2",
      }),
    ]),
  ).rejects.toThrow("send failed");
});

test("concurrent permission.asked events for one session only flush one prompt", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  const firstSendStarted = Promise.withResolvers<void>();
  const releaseFirstSend = Promise.withResolvers<void>();
  let sendCount = 0;
  mockSendMessage = vi.fn(async () => {
    sendCount += 1;
    if (sendCount === 1) {
      firstSendStarted.resolve();
      await releaseFirstSend.promise;
    }
    return { message_id: messageIdCounter++ };
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  const first = askPermission(prompts, permissionRequest);
  await firstSendStarted.promise;
  const second = askPermission(prompts, {
    ...permissionRequest,
    id: "p2",
  });
  await Promise.resolve();
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  releaseFirstSend.resolve();
  await Promise.all([first, second]);
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("queued asked event re-checks session existence before running", async () => {
  const esMap = {
    "sess-1": { chatId: 123, threadId: undefined },
  } satisfies Record<string, ExistingSessions.Location>;
  const { bot, shutdown, client, existingSessions } = setup(esMap);
  const firstSendStarted = Promise.withResolvers<void>();
  const releaseFirstSend = Promise.withResolvers<void>();
  mockSendMessage = vi.fn(async () => {
    firstSendStarted.resolve();
    await releaseFirstSend.promise;
    return { message_id: messageIdCounter++ };
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );

  const first = askPermission(prompts, permissionRequest);
  await firstSendStarted.promise;

  const second = prompts.update({
    type: "question.asked",
    properties: questionRequest as never,
  });
  Reflect.deleteProperty(esMap, "sess-1");

  releaseFirstSend.resolve();
  await Promise.all([first, second]);

  expect(prompts.check("sess-1")).toBe(true);
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
});

test("answer callback waits for concurrent permission.replied update", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  const permissionReplyStarted = Promise.withResolvers<void>();
  const releasePermissionReply = Promise.withResolvers<void>();
  mockPermissionReply = vi.fn(async () => {
    permissionReplyStarted.resolve();
    await releasePermissionReply.promise;
    return {};
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
  const answer = prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "po:0",
  });
  await permissionReplyStarted.promise;
  const update = prompts.update({
    type: "permission.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "p1",
      reply: "once",
    },
  });
  await Promise.resolve();
  expect(mockEditMessageText).not.toHaveBeenCalled();
  releasePermissionReply.resolve();
  await Promise.all([answer, update]);
  expect(prompts.check("sess-1")).toBe(false);
  expect(mockEditMessageText).toHaveBeenCalledTimes(1);
});

// --- update replied/rejected tests ---

test("update permission.replied removes item and edits telegram", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
  await prompts.update({
    type: "permission.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "p1",
      reply: "always",
    },
  });
  expect(prompts.check("sess-1")).toBe(false);
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✓ Allowed (always)",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("update permission.replied with reject shows denied", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
  await prompts.update({
    type: "permission.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "p1",
      reply: "reject",
    },
  });
  expect(prompts.check("sess-1")).toBe(false);
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✕ Denied",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("update question.replied removes item and shows last answer", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);
  await prompts.update({
    type: "question.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "q1",
      answers: [["Claude"]],
    },
  } as never);
  expect(prompts.check("sess-1")).toBe(false);
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✓ Claude",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("update question.replied with multiple answers shows last answer", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts, multiQuestionRequest);
  await prompts.update({
    type: "question.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "mq1",
      answers: [["GPT-4"], ["TypeScript"]],
    },
  } as never);
  expect(prompts.check("sess-1")).toBe(false);
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✓ TypeScript",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("update question.rejected removes item and shows dismissed", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);
  await prompts.update({
    type: "question.rejected",
    properties: {
      sessionID: "sess-1",
      requestID: "q1",
    },
  });
  expect(prompts.check("sess-1")).toBe(false);
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✕ Dismissed",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

test("update replied is no-op for unknown session", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await prompts.update({
    type: "permission.replied",
    properties: {
      sessionID: "unknown",
      requestID: "p1",
      reply: "once",
    },
  });
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("update replied is no-op for unknown request ID (deduplication)", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
  await prompts.update({
    type: "permission.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "unknown-request",
      reply: "once",
    },
  });
  expect(prompts.check("sess-1")).toBe(true);
  // Only the sendMessage from invalidate, no editMessageText
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("update replied after user answer is no-op (race condition)", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
  // User answers first
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "po:0",
  });
  expect(prompts.check("sess-1")).toBe(false);
  mockEditMessageText.mockClear();
  // Then the replied event arrives — should be no-op
  await prompts.update({
    type: "permission.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "p1",
      reply: "once",
    },
  });
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("update replied flushes next queued item", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);
  await askPermission(prompts);
  // Only first item is flushed
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  // Replied event resolves the first item (question)
  await prompts.update({
    type: "question.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "q1",
      answers: [["Claude"]],
    },
  } as never);
  // Should flush the next item (permission)
  expect(mockSendMessage).toHaveBeenCalledTimes(2);
  expect(prompts.check("sess-1")).toBe(true);
});

test("update replied removes queued item without messageId", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  // Question is flushed (gets messageId), permission is queued (no messageId)
  await askQuestion(prompts);
  await askPermission(prompts);
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  // Permission auto-resolved while still queued
  await prompts.update({
    type: "permission.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "p1",
      reply: "always",
    },
  });
  // No editMessageText — permission was never shown
  expect(mockEditMessageText).not.toHaveBeenCalled();
  // Question is still pending
  expect(prompts.check("sess-1")).toBe(true);
});

test("update replied removes only queued item and fires change hook", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  // Only a single permission — flushed immediately (gets messageId)
  await askPermission(prompts);
  onChange.mockClear();
  // Add a queued question (no messageId since permission is active)
  await prompts.update({
    type: "question.asked",
    properties: questionRequest as never,
  });
  // Auto-resolve the queued question
  await prompts.update({
    type: "question.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "q1",
      answers: [["Claude"]],
    },
  } as never);
  // Question removed silently, permission still pending
  expect(prompts.check("sess-1")).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
  // No editMessageText for the question (it was never shown)
  expect(mockEditMessageText).not.toHaveBeenCalled();
});

test("update replied removes only queued item as last item and fires change hook", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  mockSendMessage = vi.fn(async () => {
    throw new Error("send failed");
  });
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  // Flush fails — item has no messageId but is in the map
  await expect(askPermission(prompts)).rejects.toThrow();
  onChange.mockClear();
  // Auto-resolve the unflushed item
  await prompts.update({
    type: "permission.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "p1",
      reply: "once",
    },
  });
  expect(prompts.check("sess-1")).toBe(false);
  expect(mockEditMessageText).not.toHaveBeenCalled();
  expect(onChange).toHaveBeenCalledWith({
    sessionId: "sess-1",
    pending: false,
  });
});

test("update replied fires change hook with pending=false for last item", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await askPermission(prompts);
  onChange.mockClear();
  await prompts.update({
    type: "permission.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "p1",
      reply: "once",
    },
  });
  expect(onChange).toHaveBeenCalledWith({
    sessionId: "sess-1",
    pending: false,
  });
});

test("update replied does not fire change hook when items remain", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await askQuestion(prompts);
  await askPermission(prompts);
  onChange.mockClear();
  await prompts.update({
    type: "question.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "q1",
      answers: [["Claude"]],
    },
  } as never);
  expect(onChange).not.toHaveBeenCalled();
});

test("update question.replied with empty answers shows empty text", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askQuestion(prompts);
  await prompts.update({
    type: "question.replied",
    properties: {
      sessionID: "sess-1",
      requestID: "q1",
      answers: [],
    },
  } as never);
  expect(prompts.check("sess-1")).toBe(false);
  expect(mockEditMessageText).toHaveBeenCalledWith(
    123,
    100,
    "✓ ",
    expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
  );
});

// --- change hook tests ---

test("update fires change hook with pending=true for new session", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await askPermission(prompts);
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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await askPermission(prompts);
  expect(onChange).toHaveBeenCalledWith({
    sessionId: "sess-1",
    pending: true,
  });
});

test("resolving last item fires change hook with pending=false", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await askPermission(prompts);
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
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  const onChange = vi.fn();
  prompts.hook("change", onChange);
  await askPermission(prompts, { ...permissionRequest, id: "p1" });
  await askPermission(prompts, { ...permissionRequest, id: "p2" });
  onChange.mockClear();
  await prompts.answer({
    sessionId: "sess-1",
    callbackQueryId: "cb1",
    callbackQueryData: "po:0",
  });
  expect(onChange).not.toHaveBeenCalled();
});

test("change hook errors bubble up from beforeRemove", async () => {
  const { bot, shutdown, client, existingSessions } = setup();
  await using prompts = PendingPrompts.create(
    bot,
    shutdown,
    client,
    existingSessions,
  );
  await askPermission(prompts);
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
