import { assert, describe, expect, it } from "@effect/vitest";
import {
  Cause,
  ConfigProvider,
  Effect,
  Layer,
  Option,
  Runtime,
  TestClock,
} from "effect";
import { beforeEach, vi } from "vitest";
import { Bot } from "~/lib/bot";
import { Database } from "~/lib/database";
import { defaultLayer } from "~/test/default-layer";
import { opencodeLayer } from "~/test/opencode-layer";

// --- Types for grammY mock ---

interface GrammyBotContext {
  from?: { id: number };
  chat?: { id: number };
  message?: {
    message_id: number;
    text: string;
    message_thread_id?: number;
  };
  callbackQuery?: {
    data: string;
    message?: { message_id: number };
  };
  answerCallbackQuery?: ReturnType<typeof vi.fn>;
  editMessageReplyMarkup?: ReturnType<typeof vi.fn>;
}

type GrammyErrorHandler = (err: {
  error: unknown;
  ctx: GrammyBotContext;
}) => Promise<unknown>;

type GrammyEventHandler = (ctx: GrammyBotContext) => Promise<unknown>;

interface GrammyStartOptions {
  onStart?: () => void;
}

// --- Mocks ---
// Hoisted so vi.mock() can reference them at module scope.
const {
  GrammyBot,
  InlineKeyboard,
  sendMessageMock,
  sendChatActionMock,
  editMessageTextMock,
  editMessageReplyMarkupMock,
  eventRef,
  createEventController,
} = vi.hoisted(() => {
  const sendMessageMock = vi.fn().mockResolvedValue({ message_id: 1 });
  const sendChatActionMock = vi.fn().mockResolvedValue(undefined);
  const editMessageTextMock = vi.fn().mockResolvedValue(undefined);
  const editMessageReplyMarkupMock = vi.fn().mockResolvedValue(undefined);

  class GrammyBot {
    api = {
      sendMessage: sendMessageMock,
      sendChatAction: sendChatActionMock,
      setMyCommands: vi.fn().mockResolvedValue(undefined),
      editMessageText: editMessageTextMock,
      editMessageReplyMarkup: editMessageReplyMarkupMock,
    };
    private resolve?: () => void;

    async start(options?: GrammyStartOptions) {
      options?.onStart?.();
      return new Promise<void>((resolve) => {
        this.resolve = resolve;
      });
    }

    async stop() {
      this.resolve?.();
    }

    catch(_handler: GrammyErrorHandler) {}

    command(_command: string, _callback: GrammyEventHandler) {}

    on(_event: string, _callback: GrammyEventHandler) {}
  }

  // Controllable async iterator that simulates OpenCode's SSE event stream.
  // Uses a plain AsyncIterator (not async generator) so that return() can
  // synchronously resolve a pending next() — async generators queue return()
  // while executing, which causes deadlocks on scope teardown.
  function createEventController() {
    let nextResolve: ((value: IteratorResult<unknown>) => void) | undefined;
    const queued: unknown[] = [];

    function push(event: unknown) {
      if (nextResolve) {
        const r = nextResolve;
        nextResolve = undefined;
        r({ done: false, value: event });
      } else {
        queued.push(event);
      }
    }

    function stream(): AsyncIterable<unknown> {
      const iterator: AsyncIterator<unknown> = {
        async next() {
          const event = queued.shift();
          if (event !== undefined) {
            return { done: false as const, value: event };
          }
          return new Promise((r) => {
            nextResolve = r;
          });
        },
        async return() {
          if (nextResolve) {
            const r = nextResolve;
            nextResolve = undefined;
            r({ done: true, value: undefined });
          }
          return { done: true as const, value: undefined };
        },
      };
      return { [Symbol.asyncIterator]: () => iterator };
    }

    return { push, stream };
  }

  const eventRef = { current: createEventController() };

  // Import the real InlineKeyboard — it's just a data container, no need to mock.
  const { InlineKeyboard } = require("grammy");

  return {
    GrammyBot,
    InlineKeyboard,
    sendMessageMock,
    sendChatActionMock,
    editMessageTextMock,
    editMessageReplyMarkupMock,
    eventRef,
    createEventController,
  };
});

vi.mock("grammy", () => ({
  Bot: GrammyBot,
  InlineKeyboard: InlineKeyboard,
}));

const startSpy = vi.spyOn(GrammyBot.prototype, "start");
const stopSpy = vi.spyOn(GrammyBot.prototype, "stop");
const commandSpy = vi.spyOn(GrammyBot.prototype, "command");
const onSpy = vi.spyOn(GrammyBot.prototype, "on");
const catchSpy = vi.spyOn(GrammyBot.prototype, "catch");

const sessionCreateMock = vi.fn().mockResolvedValue({
  data: { id: "new-session-id" },
});

// Default mock: pushes a completed assistant message event so the event stream
// fiber processes the reply without delay. Tests override for other behavior.
let msgCounter = 0;
const sessionPromptAsyncMock = vi
  .fn()
  .mockImplementation(async (args: { sessionID: string }) => {
    const msgId = `msg-${++msgCounter}`;
    eventRef.current.push({
      type: "message.updated",
      properties: {
        info: {
          id: msgId,
          sessionID: args.sessionID,
          role: "assistant",
          time: { created: 1, completed: 2 },
        },
      },
    });
    return { data: undefined };
  });

const sessionMessageMock = vi.fn().mockResolvedValue({
  data: {
    info: { id: "msg-1", role: "assistant" },
    parts: [{ type: "text", text: "AI response" }],
  },
});

const sessionStatusMock = vi.fn().mockResolvedValue({
  data: {},
});

const sessionDeleteMock = vi.fn().mockResolvedValue({
  data: undefined,
});

const sessionAbortMock = vi.fn().mockResolvedValue({
  data: true,
});

const sessionSummarizeMock = vi.fn().mockResolvedValue({
  data: true,
});

const questionListMock = vi.fn().mockResolvedValue({
  data: [],
});

const questionReplyMock = vi.fn().mockResolvedValue({
  data: undefined,
});

const questionRejectMock = vi.fn().mockResolvedValue({
  data: undefined,
});

const permissionListMock = vi.fn().mockResolvedValue({
  data: [],
});

const permissionReplyMock = vi.fn().mockResolvedValue({
  data: undefined,
});

const sessionMessagesMock = vi.fn().mockResolvedValue({
  data: [],
});

// Exposed as a spy so tests can override with broken streams for reconnect tests
const eventSubscribeMock = vi
  .fn()
  .mockImplementation(async () => ({ stream: eventRef.current.stream() }));

vi.mock("@opencode-ai/sdk/v2/client", () => ({
  createOpencodeClient: () => ({
    session: {
      abort: sessionAbortMock,
      create: sessionCreateMock,
      delete: sessionDeleteMock,
      promptAsync: sessionPromptAsyncMock,
      message: sessionMessageMock,
      messages: sessionMessagesMock,
      status: sessionStatusMock,
      summarize: sessionSummarizeMock,
    },
    event: {
      subscribe: eventSubscribeMock,
    },
    question: {
      list: questionListMock,
      reply: questionReplyMock,
      reject: questionRejectMock,
    },
    permission: {
      list: permissionListMock,
      reply: permissionReplyMock,
    },
  }),
}));

const {
  formatBusyMock,
  formatCompactMock,
  formatErrorMock,
  formatMessageMock,
  formatPermissionMessageMock,
  formatPermissionPendingMock,
  formatPermissionPromptMock,
  formatPermissionRepliedMock,
  formatQuestionMessageMock,
  formatQuestionPendingMock,
  formatQuestionPromptMock,
  formatResetMock,
  formatStartMock,
  formatStopMock,
} = vi.hoisted(() => {
  const { Effect } = require("effect");
  return {
    formatBusyMock: vi
      .fn()
      .mockReturnValue(Effect.succeed([{ text: "busy", markdown: "busy" }])),
    formatCompactMock: vi
      .fn()
      .mockReturnValue(
        Effect.succeed([{ text: "compact msg", markdown: "compact msg" }]),
      ),
    formatResetMock: vi
      .fn()
      .mockReturnValue(
        Effect.succeed([{ text: "reset msg", markdown: "reset msg" }]),
      ),
    formatErrorMock: vi
      .fn()
      .mockReturnValue(
        Effect.succeed([{ text: "raw error", markdown: "formatted error" }]),
      ),
    formatMessageMock: vi
      .fn()
      .mockReturnValue(
        Effect.succeed([{ text: "AI response", markdown: "AI response" }]),
      ),
    formatPermissionMessageMock: vi
      .fn()
      .mockReturnValue(
        Effect.succeed([
          { text: "permission msg", markdown: "permission msg" },
        ]),
      ),
    formatPermissionPendingMock: vi
      .fn()
      .mockReturnValue(
        Effect.succeed([
          { text: "pending permission", markdown: "pending permission" },
        ]),
      ),
    formatPermissionPromptMock: vi
      .fn()
      .mockReturnValue("_How would you like to proceed?_"),
    formatPermissionRepliedMock: vi.fn().mockReturnValue("✓ Allowed (once)"),
    formatQuestionMessageMock: vi
      .fn()
      .mockReturnValue(
        Effect.succeed([{ text: "question msg", markdown: "question msg" }]),
      ),
    formatQuestionPendingMock: vi
      .fn()
      .mockReturnValue(
        Effect.succeed([
          { text: "pending question", markdown: "pending question" },
        ]),
      ),
    formatQuestionPromptMock: vi
      .fn()
      .mockReturnValue("Choose an option or type your answer."),
    formatStartMock: vi
      .fn()
      .mockReturnValue(
        Effect.succeed([{ text: "start msg", markdown: "start msg" }]),
      ),
    formatStopMock: vi
      .fn()
      .mockReturnValue(
        Effect.succeed([{ text: "stop msg", markdown: "stop msg" }]),
      ),
  };
});

vi.mock("~/lib/format-busy", () => ({
  formatBusy: formatBusyMock,
}));

vi.mock("~/lib/format-compact", () => ({
  formatCompact: formatCompactMock,
}));

vi.mock("~/lib/format-reset", () => ({
  formatReset: formatResetMock,
}));

vi.mock("~/lib/format-error", () => ({
  formatError: formatErrorMock,
}));

vi.mock("~/lib/format-message", () => ({
  formatMessage: formatMessageMock,
}));

vi.mock("~/lib/format-permission-message", () => ({
  formatPermissionMessage: formatPermissionMessageMock,
}));

vi.mock("~/lib/format-permission-pending", () => ({
  formatPermissionPending: formatPermissionPendingMock,
}));

vi.mock("~/lib/format-permission-prompt", () => ({
  formatPermissionPrompt: formatPermissionPromptMock,
}));

vi.mock("~/lib/format-permission-replied", () => ({
  formatPermissionReplied: formatPermissionRepliedMock,
}));

vi.mock("~/lib/format-start", () => ({
  formatStart: formatStartMock,
}));

vi.mock("~/lib/format-question-message", () => ({
  formatQuestionMessage: formatQuestionMessageMock,
}));

vi.mock("~/lib/format-question-pending", () => ({
  formatQuestionPending: formatQuestionPendingMock,
}));

vi.mock("~/lib/format-question-prompt", () => ({
  formatQuestionPrompt: formatQuestionPromptMock,
}));

vi.mock("~/lib/format-stop", () => ({
  formatStop: formatStopMock,
}));

// --- Test setup ---

// Each test gets a fresh event stream and sendMessage mock so state doesn't leak
beforeEach(() => {
  eventRef.current = createEventController();
  msgCounter = 0;
  sendMessageMock.mockClear().mockResolvedValue({ message_id: 1 });
  sendChatActionMock.mockClear();
  sessionAbortMock.mockClear();
  sessionDeleteMock.mockClear();
  sessionMessagesMock.mockClear();
  sessionStatusMock.mockClear();
  sessionSummarizeMock.mockClear();
  editMessageTextMock.mockClear();
  editMessageReplyMarkupMock.mockClear();
  questionListMock.mockClear();
  questionReplyMock.mockClear();
  questionRejectMock.mockClear();
  permissionListMock.mockClear();
  permissionReplyMock.mockClear();
});

/** Yields the event loop until the reconciliation fiber has called session.messages. */
const waitForReconciliation = Effect.gen(function* () {
  for (let i = 0; i < 100; i++) {
    if (sessionMessagesMock.mock.calls.length > 0) return;
    yield* Effect.promise(() => new Promise((r) => setTimeout(r, 1)));
  }
});

const validConfig = {
  TELEGRAM_BOT_TOKEN: "test:fake-token",
  TELEGRAM_USER_ID: 123,
};

function makeLayer(config: Record<string, unknown>) {
  return Bot.layer.pipe(
    Layer.provideMerge(
      Layer.setConfigProvider(ConfigProvider.fromJson(config)),
    ),
    Layer.provideMerge(opencodeLayer),
    Layer.provideMerge(defaultLayer),
  );
}

/** Base layer without Bot — lets tests insert DB data before Bot construction. */
const validBaseLayer = Layer.mergeAll(
  Layer.setConfigProvider(ConfigProvider.fromJson(validConfig)),
  opencodeLayer,
  defaultLayer,
);

/**
 * Provides Bot.layer lazily within the current scope. Use this in tests that
 * seed the database before reconciliation runs (provide `validBaseLayer`
 * instead of `validFullLayer` to avoid eager Bot construction).
 */
const provideBotLazily = Effect.gen(function* () {
  yield* Bot;
  yield* waitForReconciliation;
}).pipe(Effect.provide(Bot.layer));

/** Full layer with Bot eagerly constructed — use for non-reconciliation tests. */
const validFullLayer = makeLayer(validConfig);

describe("layer", () => {
  it.live("calls start on acquire and stop on release", () =>
    Effect.gen(function* () {
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Bot;
          yield* Effect.sleep(0);
          expect(startSpy).toHaveBeenCalledTimes(1);
          expect(stopSpy).not.toHaveBeenCalled();
        }).pipe(Effect.provide(validFullLayer)),
      );
      expect(stopSpy).toHaveBeenCalledTimes(1);
    }),
  );

  it.live("logs error when stop rejects", () =>
    Effect.gen(function* () {
      stopSpy.mockImplementationOnce(function (
        this: InstanceType<typeof GrammyBot>,
      ) {
        const original = GrammyBot.prototype.stop;
        return original.call(this).then(() => {
          throw new Error("stop failed");
        });
      });
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Bot;
          yield* Effect.sleep(0);
        }).pipe(Effect.provide(validFullLayer)),
      );
    }),
  );

  it.scopedLive.fails("dies when start rejects", () => {
    startSpy.mockRejectedValueOnce(new Error("start failed"));
    return Effect.gen(function* () {
      const { fiber } = yield* Bot;
      yield* fiber;
    }).pipe(Effect.provide(validFullLayer));
  });

  it.scopedLive.fails("fails without TELEGRAM_BOT_TOKEN", () =>
    Bot.pipe(Effect.provide(makeLayer({ TELEGRAM_USER_ID: 123 }))),
  );

  it.scopedLive.fails("fails without TELEGRAM_USER_ID", () =>
    Bot.pipe(
      Effect.provide(makeLayer({ TELEGRAM_BOT_TOKEN: "test:fake-token" })),
    ),
  );
});

describe("handler", () => {
  it.scopedLive("is registered before start", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      expect(onSpy).toHaveBeenCalledWith("message:text", expect.any(Function));
      const onOrder = onSpy.mock.invocationCallOrder.at(0);
      const startOrder = startSpy.mock.invocationCallOrder.at(0);
      assert.isDefined(onOrder);
      assert.isDefined(startOrder);
      expect(onOrder).toBeLessThan(startOrder);
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("creates session and replies for authorized user", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionCreateMock).toHaveBeenCalledWith({});
      expect(sessionStatusMock).toHaveBeenCalledWith({});
      expect(sessionPromptAsyncMock).toHaveBeenCalledWith({
        sessionID: "new-session-id",
        parts: [{ type: "text", text: "hello" }],
      });
      expect(sendMessageMock).toHaveBeenCalledWith(123, expect.any(String), {
        parse_mode: "MarkdownV2",
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("reuses existing session", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "existing-session-id",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionCreateMock).not.toHaveBeenCalled();
      expect(sessionPromptAsyncMock).toHaveBeenCalledWith({
        sessionID: "existing-session-id",
        parts: [{ type: "text", text: "hello" }],
      });
      expect(sendMessageMock).toHaveBeenCalledWith(123, expect.any(String), {
        parse_mode: "MarkdownV2",
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive(
    "resolves concurrent session insert via unique constraint",
    () =>
      Effect.gen(function* () {
        const database = yield* Database;
        // Pre-insert the "winner" session (the one that won the race)
        yield* database.session.insert({
          id: "winner-session-id",
          chatId: 123,
          threadId: 0,
          createdAt: undefined,
          updatedAt: undefined,
        });
        // First findByChat returns None (simulates the race window where
        // neither handler has inserted yet), retry returns the winner's row.
        const originalFindByChat = database.session.findByChat.bind(
          database.session,
        );
        let findByChatCallCount = 0;
        vi.spyOn(database.session, "findByChat").mockImplementation(
          (...args: Parameters<typeof database.session.findByChat>) => {
            findByChatCallCount++;
            if (findByChatCallCount === 1) return Effect.succeed(Option.none());
            return originalFindByChat(...args);
          },
        );
        // Insert defects as if the loser hit unique constraint
        vi.spyOn(database.session, "insert").mockImplementationOnce(() =>
          Effect.die(new Error("UNIQUE constraint failed")),
        );
        // The loser creates its own OpenCode session
        sessionCreateMock.mockResolvedValueOnce({
          data: { id: "loser-session-id" },
        });
        yield* Bot;
        yield* Effect.sleep(0);
        const call = onSpy.mock.lastCall;
        assert.isDefined(call);
        const handler = call[1];
        yield* Effect.promise(() =>
          handler({
            from: { id: 123 },
            chat: { id: 123 },
            message: { message_id: 1, text: "hello" },
          }),
        );
        yield* Effect.sleep(0);
        // Should have deleted the loser's orphaned session
        expect(sessionDeleteMock).toHaveBeenCalledWith({
          sessionID: "loser-session-id",
        });
        // Should have prompted with the winner's session ID
        expect(sessionPromptAsyncMock).toHaveBeenCalledWith({
          sessionID: "winner-session-id",
          parts: [{ type: "text", text: "hello" }],
        });
      }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("dies when insert defects and no winner found", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      vi.spyOn(database.session, "insert").mockImplementationOnce(() =>
        Effect.die(new Error("disk I/O error")),
      );
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(async () => {
        await expect(
          handler({
            from: { id: 123 },
            chat: { id: 123 },
            message: { message_id: 1, text: "hello" },
          }),
        ).rejects.toThrow("disk I/O error");
      });
      expect(sessionPromptAsyncMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("dies when orphaned session delete fails", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      // Pre-insert the winner
      yield* database.session.insert({
        id: "winner-session-id",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      const originalFindByChat = database.session.findByChat.bind(
        database.session,
      );
      let findByChatCallCount = 0;
      vi.spyOn(database.session, "findByChat").mockImplementation(
        (...args: Parameters<typeof database.session.findByChat>) => {
          findByChatCallCount++;
          if (findByChatCallCount === 1) return Effect.succeed(Option.none());
          return originalFindByChat(...args);
        },
      );
      vi.spyOn(database.session, "insert").mockImplementationOnce(() =>
        Effect.die(new Error("UNIQUE constraint failed")),
      );
      sessionCreateMock.mockResolvedValueOnce({
        data: { id: "orphan-session-id" },
      });
      sessionDeleteMock.mockResolvedValueOnce({
        error: new Error("delete failed"),
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(async () => {
        await expect(
          handler({
            from: { id: 123 },
            chat: { id: 123 },
            message: { message_id: 1, text: "hello" },
          }),
        ).rejects.toThrow("delete failed");
      });
      expect(sessionPromptAsyncMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("creates separate sessions for different threads", () =>
    Effect.gen(function* () {
      // Each promptAsync must push its own completion event
      sessionCreateMock
        .mockResolvedValueOnce({ data: { id: "session-a" } })
        .mockResolvedValueOnce({ data: { id: "session-b" } });
      sessionPromptAsyncMock
        .mockImplementationOnce(async (args: { sessionID: string }) => {
          eventRef.current.push({
            type: "message.updated",
            properties: {
              info: {
                id: "msg-1",
                sessionID: args.sessionID,
                role: "assistant",
                time: { created: 1, completed: 2 },
              },
            },
          });
          return { data: undefined };
        })
        .mockImplementationOnce(async (args: { sessionID: string }) => {
          eventRef.current.push({
            type: "message.updated",
            properties: {
              info: {
                id: "msg-2",
                sessionID: args.sessionID,
                role: "assistant",
                time: { created: 1, completed: 2 },
              },
            },
          });
          return { data: undefined };
        });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      // Message in thread 42
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello", message_thread_id: 42 },
        }),
      );
      yield* Effect.sleep(0);
      // Message in thread 43
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 2, text: "world", message_thread_id: 43 },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionCreateMock).toHaveBeenCalledTimes(2);
      expect(sessionPromptAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({ sessionID: "session-a" }),
      );
      expect(sessionPromptAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({ sessionID: "session-b" }),
      );
    }).pipe(Effect.provide(validFullLayer)),
  );

  // Uses Effect.promise + rejects.toThrow instead of it.scopedLive.fails so
  // we can assert post-failure state (e.g. reply not called).
  it.scopedLive("dies when session create returns error", () =>
    Effect.gen(function* () {
      sessionCreateMock.mockResolvedValueOnce({
        data: undefined,
        error: new Error("create failed"),
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(async () => {
        await expect(
          handler({
            from: { id: 123 },
            chat: { id: 123 },
            message: { message_id: 1, text: "hello" },
          }),
        ).rejects.toThrow();
      });
      expect(sendMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("dies when session prompt returns error", () =>
    Effect.gen(function* () {
      sessionPromptAsyncMock.mockResolvedValueOnce({
        data: undefined,
        error: new Error("prompt failed"),
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(async () => {
        await expect(
          handler({
            from: { id: 123 },
            chat: { id: 123 },
            message: { message_id: 1, text: "hello" },
          }),
        ).rejects.toThrow();
      });
      expect(sendMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("dies when session status returns error", () =>
    Effect.gen(function* () {
      // First call is consumed by typing reconciliation on startup
      sessionStatusMock
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({
          data: undefined,
          error: new Error("status failed"),
        });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(async () => {
        await expect(
          handler({
            from: { id: 123 },
            chat: { id: 123 },
            message: { message_id: 1, text: "hello" },
          }),
        ).rejects.toThrow();
      });
      expect(sendMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("sends error to Telegram on session.error event", () =>
    Effect.gen(function* () {
      sessionPromptAsyncMock.mockImplementationOnce(
        async (args: { sessionID: string }) => {
          eventRef.current.push({
            type: "session.error",
            properties: {
              sessionID: args.sessionID,
              error: { message: "provider auth failed" },
            },
          });
          return { data: undefined };
        },
      );
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      expect(formatErrorMock).toHaveBeenCalled();
      expect(sendMessageMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("sends error to user when session.error send fails", () =>
    Effect.gen(function* () {
      sessionPromptAsyncMock.mockImplementationOnce(
        async (args: { sessionID: string }) => {
          eventRef.current.push({
            type: "session.error",
            properties: {
              sessionID: args.sessionID,
              error: { message: "provider auth failed" },
            },
          });
          return { data: undefined };
        },
      );
      // Both MarkdownV2 and plain text fallback must fail to trigger a defect
      sendMessageMock
        .mockRejectedValueOnce(new Error("MarkdownV2 failed"))
        .mockRejectedValueOnce(new Error("plain text failed"))
        .mockResolvedValue(undefined);
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      // First two calls failed (session.error send), third call succeeded
      // (catchAllDefect sent the Telegram error to user)
      expect(sendMessageMock).toHaveBeenCalledTimes(3);
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive(
    "sends stop message on session.error with MessageAbortedError",
    () =>
      Effect.gen(function* () {
        sessionPromptAsyncMock.mockImplementationOnce(
          async (args: { sessionID: string }) => {
            eventRef.current.push({
              type: "session.error",
              properties: {
                sessionID: args.sessionID,
                error: {
                  name: "MessageAbortedError",
                  data: { message: "aborted" },
                },
              },
            });
            return { data: undefined };
          },
        );
        yield* Bot;
        yield* Effect.sleep(0);
        const call = onSpy.mock.lastCall;
        assert.isDefined(call);
        const handler = call[1];
        yield* Effect.promise(() =>
          handler({
            from: { id: 123 },
            chat: { id: 123 },
            message: { message_id: 1, text: "hello" },
          }),
        );
        yield* Effect.sleep(0);
        expect(formatErrorMock).not.toHaveBeenCalled();
        expect(formatStopMock).toHaveBeenCalled();
        expect(sendMessageMock).toHaveBeenCalled();
      }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores events for unknown sessions", () =>
    Effect.gen(function* () {
      sessionPromptAsyncMock.mockImplementationOnce(
        async (args: { sessionID: string }) => {
          // Push events for a session that has no DB entry
          eventRef.current.push({
            type: "message.updated",
            properties: {
              info: {
                id: "msg-x",
                sessionID: "unknown-session",
                role: "assistant",
                time: { created: 1, completed: 2 },
              },
            },
          });
          eventRef.current.push({
            type: "session.error",
            properties: { sessionID: "unknown-session", error: "oops" },
          });
          eventRef.current.push({
            type: "session.error",
            properties: {},
          });
          // Push an unrelated event type (should be silently ignored)
          eventRef.current.push({
            type: "session.idle",
            properties: { sessionID: args.sessionID },
          });
          // Then push the real completion event
          eventRef.current.push({
            type: "message.updated",
            properties: {
              info: {
                id: "msg-1",
                sessionID: args.sessionID,
                role: "assistant",
                time: { created: 1, completed: 2 },
              },
            },
          });
          return { data: undefined };
        },
      );
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      // The unknown session events were logged and skipped
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores incomplete assistant messages", () =>
    Effect.gen(function* () {
      sessionPromptAsyncMock.mockImplementationOnce(
        async (args: { sessionID: string }) => {
          // Push an incomplete message first (no time.completed), then a complete one
          eventRef.current.push({
            type: "message.updated",
            properties: {
              info: {
                id: "msg-1",
                sessionID: args.sessionID,
                role: "assistant",
                time: { created: 1 },
              },
            },
          });
          eventRef.current.push({
            type: "message.updated",
            properties: {
              info: {
                id: "msg-1",
                sessionID: args.sessionID,
                role: "assistant",
                time: { created: 1, completed: 2 },
              },
            },
          });
          return { data: undefined };
        },
      );
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      // session.message should only be called once (for the completed message)
      expect(sessionMessageMock).toHaveBeenCalledTimes(1);
      expect(sendMessageMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("deduplicates completed messages with same id", () =>
    Effect.gen(function* () {
      sessionPromptAsyncMock.mockImplementationOnce(
        async (args: { sessionID: string }) => {
          // Push the same completed message twice
          eventRef.current.push({
            type: "message.updated",
            properties: {
              info: {
                id: "msg-dup",
                sessionID: args.sessionID,
                role: "assistant",
                time: { created: 1, completed: 2 },
              },
            },
          });
          eventRef.current.push({
            type: "message.updated",
            properties: {
              info: {
                id: "msg-dup",
                sessionID: args.sessionID,
                role: "assistant",
                time: { created: 1, completed: 2 },
              },
            },
          });
          return { data: undefined };
        },
      );
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      // session.message should only be called once despite two identical events
      expect(sessionMessageMock).toHaveBeenCalledTimes(1);
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("sends error when session.message returns error", () =>
    Effect.gen(function* () {
      sessionMessageMock.mockResolvedValueOnce({
        data: undefined,
        error: new Error("message fetch failed"),
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      expect(formatErrorMock).toHaveBeenCalled();
      expect(sendMessageMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("does not send when response has no text parts", () =>
    Effect.gen(function* () {
      sessionMessageMock.mockResolvedValueOnce({
        data: {
          info: { id: "msg-1", role: "assistant" },
          parts: [{ type: "tool" }],
        },
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sendMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores messages from unauthorized user", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 999 },
          chat: { id: 999 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      expect(sendMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("sends busy message when session status is busy", () =>
    Effect.gen(function* () {
      sessionStatusMock
        .mockResolvedValueOnce({ data: {} }) // reconciliation
        .mockResolvedValueOnce({
          data: { "new-session-id": { type: "busy" } },
        });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      expect(formatBusyMock).toHaveBeenCalled();
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      expect(sessionPromptAsyncMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("handles retry status as busy", () =>
    Effect.gen(function* () {
      sessionStatusMock
        .mockResolvedValueOnce({ data: {} }) // reconciliation
        .mockResolvedValueOnce({
          data: {
            "new-session-id": {
              type: "retry",
              attempt: 1,
              message: "rate limited",
              next: 5000,
            },
          },
        });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      expect(formatBusyMock).toHaveBeenCalled();
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      expect(sessionPromptAsyncMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive(
    "sends busy message when concurrent message races past status check",
    () =>
      Effect.gen(function* () {
        // Both status checks return idle — simulates two messages arriving
        // before the first promptAsync completes, testing the local guard.
        sessionStatusMock
          .mockResolvedValueOnce({ data: {} })
          .mockResolvedValueOnce({ data: {} });
        let resolveFirst!: () => void;
        sessionPromptAsyncMock.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = () => resolve({ data: undefined });
            }),
        );
        yield* Bot;
        yield* Effect.sleep(0);
        const call = onSpy.mock.lastCall;
        assert.isDefined(call);
        const handler = call[1];
        // First message: starts promptAsync but doesn't resolve yet
        const firstPromise = handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "first" },
        });
        yield* Effect.sleep(0);
        // Second message: same session, status says idle but local guard blocks
        yield* Effect.promise(() =>
          handler({
            from: { id: 123 },
            chat: { id: 123 },
            message: { message_id: 2, text: "second" },
          }),
        );
        yield* Effect.sleep(0);
        expect(formatBusyMock).toHaveBeenCalledTimes(1);
        expect(sessionPromptAsyncMock).toHaveBeenCalledTimes(1);
        // Resolve the first promptAsync so cleanup runs
        resolveFirst();
        yield* Effect.promise(() => firstPromise);
      }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("different threads are not blocked by each other", () =>
    Effect.gen(function* () {
      sessionCreateMock
        .mockResolvedValueOnce({ data: { id: "session-a" } })
        .mockResolvedValueOnce({ data: { id: "session-b" } });
      // Both sessions are idle
      sessionStatusMock
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: {} });
      sessionPromptAsyncMock
        .mockResolvedValueOnce({ data: undefined })
        .mockImplementationOnce(async (args: { sessionID: string }) => {
          eventRef.current.push({
            type: "message.updated",
            properties: {
              info: {
                id: "msg-1",
                sessionID: args.sessionID,
                role: "assistant",
                time: { created: 1, completed: 2 },
              },
            },
          });
          return { data: undefined };
        });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      // Thread 42
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello", message_thread_id: 42 },
        }),
      );
      yield* Effect.sleep(0);
      // Thread 43: should NOT be blocked by thread 42
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 2, text: "world", message_thread_id: 43 },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionCreateMock).toHaveBeenCalledTimes(2);
      expect(sessionPromptAsyncMock).toHaveBeenCalledTimes(2);
      expect(formatBusyMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("sends plain text reply for unformatted chunk", () =>
    Effect.gen(function* () {
      formatMessageMock.mockReturnValueOnce(
        Effect.succeed([{ text: "plain reply" }]),
      );
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      expect(sendMessageMock).toHaveBeenCalledWith(123, "plain reply", {});
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("falls back to plain text reply when MarkdownV2 fails", () =>
    Effect.gen(function* () {
      sendMessageMock
        .mockRejectedValueOnce(new Error("parse error"))
        .mockResolvedValue(undefined);
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sendMessageMock).toHaveBeenCalledTimes(2);
      const fallbackCall = sendMessageMock.mock.calls.at(1);
      assert.isDefined(fallbackCall);
      // Fallback call: sendMessage(chatId, text, {}) — no parse_mode
      expect(fallbackCall[2]).toEqual({});
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("sends formatted error on catch", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = catchSpy.mock.lastCall;
      assert.isDefined(call);
      const errorHandler = call[0];
      yield* Effect.promise(() =>
        errorHandler({
          error: new Error("test error"),
          ctx: { chat: { id: 123 } },
        }),
      );
      expect(sendMessageMock).toHaveBeenCalled();
      const firstCall = sendMessageMock.mock.calls.at(0);
      assert.isDefined(firstCall);
      expect(firstCall[0]).toBe(123);
      expect(firstCall[1]).toContain("error");
      expect(firstCall[2]).toEqual({ parse_mode: "MarkdownV2" });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("skips reply when catch ctx has no chat", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = catchSpy.mock.lastCall;
      assert.isDefined(call);
      const errorHandler = call[0];
      yield* Effect.promise(() =>
        errorHandler({
          error: new Error("test error"),
          ctx: {},
        }),
      );
      expect(sendMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("unwraps FiberFailure before formatting", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = catchSpy.mock.lastCall;
      assert.isDefined(call);
      const errorHandler = call[0];
      const fiberFailure = Runtime.makeFiberFailure(
        Cause.die(new Error("wrapped error")),
      );
      yield* Effect.promise(() =>
        errorHandler({
          error: fiberFailure,
          ctx: { chat: { id: 123 } },
        }),
      );
      expect(formatErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: "wrapped error" }),
      );
    }).pipe(Effect.provide(validFullLayer)),
  );

  // Verifies that when the SSE stream errors, the bot reconnects and
  // continues processing events on the new connection.
  it.scoped("reconnects event stream after error", () => {
    // Must set mock before Effect.provide constructs the layer,
    // since subscribe is called during Bot layer construction.
    const broken: AsyncIterable<unknown> = {
      [Symbol.asyncIterator]: () => ({
        async next() {
          throw new Error("SSE connection lost");
        },
        async return() {
          return { done: true as const, value: undefined };
        },
      }),
    };
    eventSubscribeMock.mockImplementationOnce(async () => ({
      stream: broken,
    }));

    return Effect.gen(function* () {
      yield* Bot;
      // Advance TestClock past the 1-second initial reconnect delay
      yield* TestClock.adjust("1 second");

      // Second subscribe call uses the default mock (eventRef.current),
      // so the bot should be functional again.
      expect(eventSubscribeMock).toHaveBeenCalledTimes(2);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.yieldNow();
      expect(sendMessageMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer));
  });

  it.scoped("crashes after max reconnect attempts", () => {
    // All subscribe calls fail
    const defaultImpl =
      eventSubscribeMock.getMockImplementation() ?? (() => {});
    eventSubscribeMock.mockImplementation(async () => {
      throw new Error("SSE connection refused");
    });

    return Effect.gen(function* () {
      yield* Bot;
      // Advance clock through all 10 attempts:
      // 1s + 2s + 4s + 8s + 16s + 30s + 30s + 30s + 30s + 30s = 181s
      yield* TestClock.adjust("181 seconds");
      // The fiber should have crashed — subscribe was called 11 times
      // (1 initial + 10 retries) before dying on the 11th failure
      expect(eventSubscribeMock).toHaveBeenCalledTimes(11);
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => eventSubscribeMock.mockImplementation(defaultImpl)),
      ),
      Effect.provide(validFullLayer),
    );
  });

  it.scopedLive("continues event stream after processEvent defect", () =>
    Effect.gen(function* () {
      // First call rejects (defect), second call uses the default mock
      sessionMessageMock.mockRejectedValueOnce(new Error("network error"));
      sessionPromptAsyncMock.mockImplementationOnce(
        async (args: { sessionID: string }) => {
          const msgId = `msg-${++msgCounter}`;
          eventRef.current.push({
            type: "message.updated",
            properties: {
              info: {
                id: msgId,
                sessionID: args.sessionID,
                role: "assistant",
                time: { created: 1, completed: 2 },
              },
            },
          });
          return { data: undefined };
        },
      );
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      // First call: session.message rejects → defect caught, error sent to user
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      expect(formatErrorMock).toHaveBeenCalledTimes(1);
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      // Second call: uses default mocks → should work normally
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sendMessageMock).toHaveBeenCalledTimes(2);
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive(
    "continues event stream after findById defect in processEvent",
    () =>
      Effect.gen(function* () {
        const database = yield* Database;
        // Make findById defect once, then restore normal behavior
        vi.spyOn(database.session, "findById").mockImplementationOnce(() =>
          Effect.die(new Error("DB locked")),
        );
        yield* Bot;
        yield* Effect.sleep(0);
        // Push event that will hit the defective findById
        eventRef.current.push({
          type: "message.updated",
          properties: {
            info: {
              id: "msg-defect",
              sessionID: "any-session",
              role: "assistant",
              time: { created: 1, completed: 2 },
            },
          },
        });
        yield* Effect.sleep(0);
        // Stream should still be alive — send a normal message
        const call = onSpy.mock.lastCall;
        assert.isDefined(call);
        const handler = call[1];
        yield* Effect.promise(() =>
          handler({
            from: { id: 123 },
            chat: { id: 123 },
            message: { message_id: 1, text: "hello" },
          }),
        );
        yield* Effect.sleep(0);
        expect(sendMessageMock).toHaveBeenCalled();
      }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("replies in correct forum thread", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: {
            message_id: 1,
            text: "hello",
            message_thread_id: 42,
          },
        }),
      );
      yield* Effect.sleep(0);
      expect(sendMessageMock).toHaveBeenCalledWith(123, expect.any(String), {
        parse_mode: "MarkdownV2",
        message_thread_id: 42,
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("sends busy message to correct thread", () =>
    Effect.gen(function* () {
      // Reconciliation, first handler call (idle), second handler call (busy)
      sessionStatusMock
        .mockResolvedValueOnce({ data: {} }) // reconciliation
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({
          data: { "new-session-id": { type: "busy" } },
        });
      // Make promptAsync NOT push an event
      sessionPromptAsyncMock.mockResolvedValueOnce({ data: undefined });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      // First message: registers session in thread 42
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: {
            message_id: 1,
            text: "hello",
            message_thread_id: 42,
          },
        }),
      );
      yield* Effect.sleep(0);
      sendMessageMock.mockClear();
      // Second message: session is busy, should reply in same thread
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: {
            message_id: 2,
            text: "hello again",
            message_thread_id: 42,
          },
        }),
      );
      expect(formatBusyMock).toHaveBeenCalled();
      expect(sendMessageMock).toHaveBeenCalledWith(123, expect.any(String), {
        parse_mode: "MarkdownV2",
        message_thread_id: 42,
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("plain text fallback preserves thread", () =>
    Effect.gen(function* () {
      sendMessageMock
        .mockRejectedValueOnce(new Error("parse error"))
        .mockResolvedValue(undefined);
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: {
            message_id: 1,
            text: "hello",
            message_thread_id: 42,
          },
        }),
      );
      yield* Effect.sleep(0);
      expect(sendMessageMock).toHaveBeenCalledTimes(2);
      const fallbackCall = sendMessageMock.mock.calls.at(1);
      assert.isDefined(fallbackCall);
      expect(fallbackCall[2]).toEqual({
        message_thread_id: 42,
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("reconciles missed messages on reconnect", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      // Pre-insert a session so reconciliation finds it
      yield* database.session.insert({
        id: "session-reconcile",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      // session.messages returns fewer than the limit (2 < 10), so the
      // loop breaks after one fetch without needing an overlap check.
      sessionMessagesMock.mockResolvedValueOnce({
        data: [
          {
            info: {
              id: "user-msg",
              sessionID: "session-reconcile",
              role: "user",
              time: { created: 0 },
            },
            parts: [{ type: "text", text: "hello" }],
          },
          {
            info: {
              id: "missed-msg",
              sessionID: "session-reconcile",
              role: "assistant",
              time: { created: 1, completed: 2 },
            },
            parts: [{ type: "text", text: "missed reply" }],
          },
        ],
      });
      yield* provideBotLazily;
      expect(sessionMessagesMock).toHaveBeenCalledWith({
        sessionID: "session-reconcile",
        limit: 10,
      });
      expect(sendMessageMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scopedLive("reconciliation skips already claimed messages", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "session-claimed",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      // Pre-claim the message so it's found in the overlap check
      yield* database.message.claim({
        id: "already-claimed",
        sessionId: "session-claimed",
        createdAt: 1,
      });
      sessionMessagesMock.mockResolvedValueOnce({
        data: [
          {
            info: {
              id: "already-claimed",
              sessionID: "session-claimed",
              role: "assistant",
              time: { created: 1, completed: 2 },
            },
            parts: [{ type: "text", text: "old reply" }],
          },
        ],
      });
      yield* provideBotLazily;
      // session.message (singular, fetch parts) should NOT be called
      expect(sessionMessageMock).not.toHaveBeenCalled();
      // No Telegram message sent from reconciliation
      expect(sendMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scopedLive(
    "reconciliation skips sessions with no assistant messages",
    () =>
      Effect.gen(function* () {
        const database = yield* Database;
        yield* database.session.insert({
          id: "session-empty",
          chatId: 123,
          threadId: 0,
          createdAt: undefined,
          updatedAt: undefined,
        });
        // Default mock returns { data: [] } — no messages at all
        yield* provideBotLazily;
        expect(sessionMessagesMock).toHaveBeenCalledWith({
          sessionID: "session-empty",
          limit: 10,
        });
        // No messages to deliver
        expect(sendMessageMock).not.toHaveBeenCalled();
      }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scopedLive(
    "reconciliation expands limit when all messages are unclaimed",
    () =>
      Effect.gen(function* () {
        const database = yield* Database;
        yield* database.session.insert({
          id: "session-expand",
          chatId: 123,
          threadId: 0,
          createdAt: undefined,
          updatedAt: undefined,
        });
        // Pre-claim msg-0 so the second fetch finds overlap
        yield* database.message.claim({
          id: "msg-0",
          sessionId: "session-expand",
          createdAt: 0,
        });
        // First fetch: returns exactly limit=10 messages, all unclaimed
        // assistant messages → no overlap, doubles limit to 20
        const tenMessages = Array.from({ length: 10 }, (_, i) => ({
          info: {
            id: `msg-${i + 1}`,
            sessionID: "session-expand",
            role: "assistant",
            time: { created: i + 1, completed: i + 2 },
          },
          parts: [{ type: "text", text: `reply ${i + 1}` }],
        }));
        sessionMessagesMock.mockResolvedValueOnce({ data: tenMessages });
        // Second fetch with limit=20: includes msg-0 (claimed) as oldest
        const twentyMessages = [
          {
            info: {
              id: "msg-0",
              sessionID: "session-expand",
              role: "assistant",
              time: { created: 0, completed: 1 },
            },
            parts: [{ type: "text", text: "reply 0" }],
          },
          ...tenMessages,
        ];
        sessionMessagesMock.mockResolvedValueOnce({ data: twentyMessages });
        yield* provideBotLazily;
        // Should have fetched twice: limit=10, then limit=20
        expect(sessionMessagesMock).toHaveBeenCalledTimes(2);
        expect(sessionMessagesMock).toHaveBeenNthCalledWith(1, {
          sessionID: "session-expand",
          limit: 10,
        });
        expect(sessionMessagesMock).toHaveBeenNthCalledWith(2, {
          sessionID: "session-expand",
          limit: 20,
        });
        // Should have sent the 10 unclaimed messages (msg-0 is already claimed)
        expect(sendMessageMock).toHaveBeenCalledTimes(10);
      }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scopedLive("reconciliation continues when session.messages errors", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "session-err",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      sessionMessagesMock.mockResolvedValueOnce({
        data: undefined,
        error: new Error("not found"),
      });
      // Should not crash — reconciliation logs and continues
      yield* provideBotLazily;
      expect(sessionMessagesMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scopedLive("reconciliation survives defect", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "session-defect",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      sessionMessagesMock.mockRejectedValueOnce(new Error("network failure"));
      // Should not crash — catchAllDefect logs and continues
      yield* provideBotLazily;
      expect(sessionMessagesMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scopedLive("ignores unrecognized event types", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "unknown.event",
        properties: {},
      });
      yield* Effect.sleep(0);
      // No crash, no side effects
      expect(sendMessageMock).not.toHaveBeenCalled();
      expect(sendChatActionMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );
});

function getCommandHandler(name: string) {
  const call = commandSpy.mock.calls.find((c) => c[0] === name);
  assert.isDefined(call);
  return call[1];
}

describe("/start command", () => {
  it.scopedLive("registers command handler before start", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      expect(commandSpy).toHaveBeenCalledWith("start", expect.any(Function));
      const cmdOrder = commandSpy.mock.invocationCallOrder.at(0);
      const startOrder = startSpy.mock.invocationCallOrder.at(0);
      assert.isDefined(cmdOrder);
      assert.isDefined(startOrder);
      expect(cmdOrder).toBeLessThan(startOrder);
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("sends start message for new session", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("start");
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "/start" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionCreateMock).toHaveBeenCalledWith({});
      expect(formatStartMock).toHaveBeenCalledWith("new-session-id", true);
      expect(sendMessageMock).toHaveBeenCalledWith(123, expect.any(String), {
        parse_mode: "MarkdownV2",
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("sends start message for existing session", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "existing-session-id",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("start");
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "/start" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionCreateMock).not.toHaveBeenCalled();
      expect(formatStartMock).toHaveBeenCalledWith(
        "existing-session-id",
        false,
      );
      expect(sendMessageMock).toHaveBeenCalledWith(123, expect.any(String), {
        parse_mode: "MarkdownV2",
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores /start from unauthorized user", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("start");
      yield* Effect.promise(() =>
        handler({
          from: { id: 999 },
          chat: { id: 999 },
          message: { message_id: 1, text: "/start" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionCreateMock).not.toHaveBeenCalled();
      expect(sendMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );
});

describe("/stop command", () => {
  it.scopedLive("calls abort on the session", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "stop-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("stop");
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "/stop" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionAbortMock).toHaveBeenCalledWith({
        sessionID: "stop-session",
      });
      // Stop message is sent by the session.error event handler.
      expect(formatStopMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("no-ops when no session exists", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("stop");
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "/stop" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionAbortMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("dies when session.abort returns error", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "stop-abort-error",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      sessionAbortMock.mockResolvedValueOnce({
        error: "abort failed",
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("stop");
      yield* Effect.promise(async () => {
        await expect(
          handler({
            from: { id: 123 },
            chat: { id: 123 },
            message: { message_id: 1, text: "/stop" },
          }),
        ).rejects.toThrow("abort failed");
      });
      expect(formatStopMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores /stop from unauthorized user", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("stop");
      yield* Effect.promise(() =>
        handler({
          from: { id: 999 },
          chat: { id: 999 },
          message: { message_id: 1, text: "/stop" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionCreateMock).not.toHaveBeenCalled();
      expect(sessionAbortMock).not.toHaveBeenCalled();
      expect(sendMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );
});

describe("/reset command", () => {
  it.scopedLive("no-ops when no session exists", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("reset");
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 456 },
          message: { message_id: 1, text: "/reset" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionAbortMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("aborts, cleans up, and sends reset message", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "reset-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("reset");
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "/reset" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionAbortMock).toHaveBeenCalledWith({
        sessionID: "reset-session",
      });
      expect(sessionDeleteMock).not.toHaveBeenCalled();
      expect(formatResetMock).toHaveBeenCalled();
      // Session should be deleted from DB
      const session = yield* database.session.findByChat({
        chatId: 123,
        threadId: 0,
      });
      expect(Option.isNone(session)).toBe(true);
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("dies when session.abort returns error in /reset", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "reset-abort-error",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      sessionAbortMock.mockResolvedValueOnce({
        error: "abort failed",
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("reset");
      yield* Effect.promise(async () => {
        await expect(
          handler({
            from: { id: 123 },
            chat: { id: 123 },
            message: { message_id: 1, text: "/reset" },
          }),
        ).rejects.toThrow("abort failed");
      });
      expect(sessionDeleteMock).not.toHaveBeenCalled();
      expect(formatResetMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores /reset from unauthorized user", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("reset");
      yield* Effect.promise(() =>
        handler({
          from: { id: 999 },
          chat: { id: 999 },
          message: { message_id: 1, text: "/reset" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionDeleteMock).not.toHaveBeenCalled();
      expect(sendMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("cascades message deletion when session is reset", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "reset-cascade-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* database.message.insert({
        id: "msg-to-cascade",
        sessionId: "reset-cascade-session",
        createdAt: 1,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("reset");
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "/reset" },
        }),
      );
      yield* Effect.sleep(0);
      // Message should be cascade-deleted
      const message = yield* database.message.findById("msg-to-cascade");
      expect(Option.isNone(message)).toBe(true);
    }).pipe(Effect.provide(validFullLayer)),
  );
});

describe("/compact command", () => {
  it.scopedLive("calls summarize on the session", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "compact-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("compact");
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "/compact" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionSummarizeMock).toHaveBeenCalledWith({
        sessionID: "compact-session",
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("no-ops when no session exists", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("compact");
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "/compact" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionSummarizeMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("dies when summarize returns error", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "compact-error-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      sessionSummarizeMock.mockResolvedValueOnce({
        error: "summarize failed",
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("compact");
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "/compact" },
        }),
      ).pipe(Effect.exit);
      expect(sessionSummarizeMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores /compact from unauthorized user", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const handler = getCommandHandler("compact");
      yield* Effect.promise(() =>
        handler({
          from: { id: 999 },
          chat: { id: 456 },
          message: { message_id: 1, text: "/compact" },
        }),
      );
      yield* Effect.sleep(0);
      expect(sessionSummarizeMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );
});

describe("session.compacted event", () => {
  it.scopedLive("sends compact message on session.compacted event", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "compacted-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      // Trigger compacted event via promptAsync so it flows through the
      // already-connected event stream (same pattern as session.error tests).
      sessionPromptAsyncMock.mockImplementationOnce(
        async (args: { sessionID: string }) => {
          eventRef.current.push({
            type: "session.compacted",
            properties: {
              sessionID: args.sessionID,
            },
          });
          return { data: undefined };
        },
      );
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      sendMessageMock.mockClear();
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
        }),
      );
      yield* Effect.sleep(0);
      expect(formatCompactMock).toHaveBeenCalled();
      expect(sendMessageMock).toHaveBeenCalledWith(123, expect.any(String), {
        parse_mode: "MarkdownV2",
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores session.compacted from unknown session", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      sendMessageMock.mockClear();
      eventRef.current.push({
        type: "session.compacted",
        properties: {
          sessionID: "unknown-compacted-session",
        },
      });
      yield* Effect.sleep(0);
      expect(formatCompactMock).not.toHaveBeenCalled();
      expect(sendMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );
});

describe("typing indicator", () => {
  it.scopedLive("starts typing on session.status busy event", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "typing-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "session.status",
        properties: {
          sessionID: "typing-session",
          status: { type: "busy" },
        },
      });
      yield* Effect.sleep(0);
      expect(sendChatActionMock).toHaveBeenCalledWith(123, "typing", {});
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("stops typing on session.status idle", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "typing-idle-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "session.status",
        properties: {
          sessionID: "typing-idle-session",
          status: { type: "busy" },
        },
      });
      yield* Effect.sleep(0);
      expect(sendChatActionMock).toHaveBeenCalled();
      sendChatActionMock.mockClear();
      eventRef.current.push({
        type: "session.status",
        properties: {
          sessionID: "typing-idle-session",
          status: { type: "idle" },
        },
      });
      yield* Effect.sleep(0);
      yield* Effect.sleep(0);
      expect(sendChatActionMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores session.status for unknown sessions", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "session.status",
        properties: {
          sessionID: "unknown-typing-session",
          status: { type: "busy" },
        },
      });
      yield* Effect.sleep(0);
      expect(sendChatActionMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("starts typing on session.status retry event", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "typing-retry-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "session.status",
        properties: {
          sessionID: "typing-retry-session",
          status: { type: "retry" },
        },
      });
      yield* Effect.sleep(0);
      expect(sendChatActionMock).toHaveBeenCalledWith(123, "typing", {});
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive(
    "is idempotent — second busy event does not fork another fiber",
    () =>
      Effect.gen(function* () {
        const database = yield* Database;
        yield* database.session.insert({
          id: "typing-idempotent",
          chatId: 123,
          threadId: 0,
          createdAt: undefined,
          updatedAt: undefined,
        });
        yield* Bot;
        yield* Effect.sleep(0);
        eventRef.current.push({
          type: "session.status",
          properties: {
            sessionID: "typing-idempotent",
            status: { type: "busy" },
          },
        });
        yield* Effect.sleep(0);
        expect(sendChatActionMock).toHaveBeenCalledTimes(1);
        // Push a second busy event for the same session
        eventRef.current.push({
          type: "session.status",
          properties: {
            sessionID: "typing-idempotent",
            status: { type: "busy" },
          },
        });
        yield* Effect.sleep(0);
        // Should still be 1 — no additional fiber forked
        expect(sendChatActionMock).toHaveBeenCalledTimes(1);
      }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("passes thread ID to sendChatAction", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "typing-thread-session",
        chatId: 123,
        threadId: 42,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "session.status",
        properties: {
          sessionID: "typing-thread-session",
          status: { type: "busy" },
        },
      });
      yield* Effect.sleep(0);
      expect(sendChatActionMock).toHaveBeenCalledWith(123, "typing", {
        message_thread_id: 42,
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores session.status with non-busy/retry status", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "typing-idle-status",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "session.status",
        properties: {
          sessionID: "typing-idle-status",
          status: { type: "idle" },
        },
      });
      yield* Effect.sleep(0);
      expect(sendChatActionMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("reconciles typing for busy sessions on reconnect", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "typing-recon",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      sessionStatusMock.mockResolvedValueOnce({
        data: { "typing-recon": { type: "busy" } },
      });
      sendChatActionMock.mockClear();
      yield* provideBotLazily;
      expect(sendChatActionMock).toHaveBeenCalledWith(123, "typing", {});
    }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scopedLive("does not start typing for idle sessions on reconnect", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "typing-idle-recon",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      sessionStatusMock.mockResolvedValueOnce({
        data: { "typing-idle-recon": { type: "idle" } },
      });
      sendChatActionMock.mockClear();
      yield* provideBotLazily;
      expect(sendChatActionMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scoped("stops stale typing on reconnect when session becomes idle", () => {
    // First reconciliation: session is busy → typing starts
    sessionStatusMock.mockResolvedValueOnce({
      data: { "typing-stale": { type: "busy" } },
    });

    // First stream errors immediately to trigger reconnect
    const broken: AsyncIterable<unknown> = {
      [Symbol.asyncIterator]: () => ({
        async next(): Promise<IteratorResult<unknown>> {
          throw new Error("SSE connection lost");
        },
        async return() {
          return { done: true as const, value: undefined };
        },
      }),
    };
    eventSubscribeMock.mockImplementationOnce(async () => ({
      stream: broken,
    }));

    // Second reconciliation: session is now idle → typing should stop
    sessionStatusMock.mockResolvedValueOnce({
      data: { "typing-stale": { type: "idle" } },
    });

    const seedLayer = Layer.effectDiscard(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* database.session.insert({
          id: "typing-stale",
          chatId: 123,
          threadId: 0,
          createdAt: undefined,
          updatedAt: undefined,
        });
      }),
    );
    const layerWithSeed = Bot.layer.pipe(
      Layer.provideMerge(seedLayer),
      Layer.provideMerge(validBaseLayer),
    );

    return Effect.gen(function* () {
      yield* Bot;
      // First reconciliation starts typing
      yield* waitForReconciliation;
      expect(sendChatActionMock).toHaveBeenCalled();
      sendChatActionMock.mockClear();
      // Advance past the 1s reconnect delay
      yield* TestClock.adjust("1 second");
      yield* waitForReconciliation;
      // After second reconciliation, typing should be stopped
      yield* Effect.sleep(0);
      expect(sendChatActionMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(layerWithSeed));
  });

  it.scopedLive("reconciliation continues when session.status errors", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "typing-err",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      sessionStatusMock.mockResolvedValueOnce({
        data: undefined,
        error: new Error("status failed"),
      });
      yield* provideBotLazily;
      // Should not crash — typing reconciliation logs and continues
      expect(sessionStatusMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validBaseLayer)),
  );
});

// --- Question helpers ---

const sampleQuestion = {
  id: "qreq-1",
  sessionID: "q-session",
  questions: [
    {
      question: "What would you like to do?",
      header: "Action",
      options: [
        { label: "Yes", description: "Approve the change" },
        { label: "No", description: "Reject the change" },
      ],
    },
  ],
};

function getCallbackQueryHandler() {
  const call = onSpy.mock.calls.find((c) => c[0] === "callback_query:data");
  assert.isDefined(call);
  return call[1];
}

function getMessageHandler() {
  const call = onSpy.mock.calls.find((c) => c[0] === "message:text");
  assert.isDefined(call);
  return call[1];
}

function makeCallbackCtx(data: string) {
  const answerCallbackQuery = vi.fn().mockResolvedValue(undefined);
  const editMessageReplyMarkup = vi.fn().mockResolvedValue(undefined);
  return {
    from: { id: 123 },
    chat: { id: 123 },
    callbackQuery: { data, message: { message_id: 10 } },
    answerCallbackQuery,
    editMessageReplyMarkup,
  };
}

describe("question.asked event", () => {
  it.scopedLive("sends question and interaction messages", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      sendMessageMock.mockClear();
      eventRef.current.push({
        type: "question.asked",
        properties: sampleQuestion,
      });
      yield* Effect.sleep(0);
      // Should send 2 messages: question content + interaction with keyboard
      expect(formatQuestionMessageMock).toHaveBeenCalled();
      expect(sendMessageMock).toHaveBeenCalledTimes(2);
      // Second message has reply_markup
      const interactionCall = sendMessageMock.mock.calls.at(1);
      assert.isDefined(interactionCall);
      expect(interactionCall[2]).toHaveProperty("reply_markup");
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("handles odd option count and non-zero threadId", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 42,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      sendMessageMock.mockClear();
      eventRef.current.push({
        type: "question.asked",
        properties: {
          ...sampleQuestion,
          questions: [
            {
              question: "Pick one",
              header: "Choice",
              options: [{ label: "Only", description: "Single option" }],
            },
          ],
        },
      });
      yield* Effect.sleep(0);
      expect(sendMessageMock).toHaveBeenCalledTimes(2);
      // Second message should include message_thread_id
      const interactionCall = sendMessageMock.mock.calls.at(1);
      assert.isDefined(interactionCall);
      expect(interactionCall[2]).toHaveProperty("message_thread_id", 42);
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores question.asked from unknown session", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      sendMessageMock.mockClear();
      eventRef.current.push({
        type: "question.asked",
        properties: sampleQuestion,
      });
      yield* Effect.sleep(0);
      expect(formatQuestionMessageMock).not.toHaveBeenCalled();
      expect(sendMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );
});

describe("question callback", () => {
  it.scopedLive("single-select answers immediately", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      sendMessageMock.mockClear();
      // Trigger question
      eventRef.current.push({
        type: "question.asked",
        properties: sampleQuestion,
      });
      yield* Effect.sleep(0);
      // Click "Yes" (option index 0, localId "0")
      const cbHandler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("q:0:0");
      yield* Effect.promise(() => cbHandler(ctx));
      yield* Effect.sleep(0);
      expect(questionReplyMock).toHaveBeenCalledWith({
        requestID: "qreq-1",
        answers: [["Yes"]],
      });
      expect(editMessageTextMock).toHaveBeenCalled();
      expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("reject dismisses the question", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "question.asked",
        properties: sampleQuestion,
      });
      yield* Effect.sleep(0);
      const cbHandler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("qr:0");
      yield* Effect.promise(() => cbHandler(ctx));
      yield* Effect.sleep(0);
      expect(questionRejectMock).toHaveBeenCalledWith({
        requestID: "qreq-1",
      });
      expect(editMessageTextMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("expired callback returns toast", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const cbHandler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("q:99:0");
      yield* Effect.promise(() => cbHandler(ctx));
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
        text: "The question has expired.",
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores callback from unauthorized user", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const cbHandler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("q:0:0");
      ctx.from = { id: 999 }; // not the authorized user (123)
      yield* Effect.promise(() => cbHandler(ctx));
      // Should silently return without answering the callback
      expect(ctx.answerCallbackQuery).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores malformed callback data", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const cbHandler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("baddata");
      yield* Effect.promise(() => cbHandler(ctx));
      // Should silently return without answering the callback
      expect(ctx.answerCallbackQuery).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("multi-select toggles and confirms", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      // Push a multi-select question
      eventRef.current.push({
        type: "question.asked",
        properties: {
          ...sampleQuestion,
          questions: [
            {
              ...sampleQuestion.questions[0],
              multiple: true,
            },
          ],
        },
      });
      yield* Effect.sleep(0);
      const cbHandler = getCallbackQueryHandler();
      // Toggle "Yes"
      const ctx1 = makeCallbackCtx("q:0:0");
      yield* Effect.promise(() => cbHandler(ctx1));
      yield* Effect.sleep(0);
      expect(ctx1.editMessageReplyMarkup).toHaveBeenCalled();
      // Confirm
      const ctx2 = makeCallbackCtx("qc:0");
      yield* Effect.promise(() => cbHandler(ctx2));
      yield* Effect.sleep(0);
      expect(questionReplyMock).toHaveBeenCalledWith({
        requestID: "qreq-1",
        answers: [["Yes"]],
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("multi-select deselects toggled option", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "question.asked",
        properties: {
          ...sampleQuestion,
          questions: [
            {
              ...sampleQuestion.questions[0],
              multiple: true,
            },
          ],
        },
      });
      yield* Effect.sleep(0);
      const cbHandler = getCallbackQueryHandler();
      // Select "Yes"
      const ctx1 = makeCallbackCtx("q:0:0");
      yield* Effect.promise(() => cbHandler(ctx1));
      yield* Effect.sleep(0);
      // Deselect "Yes"
      const ctx2 = makeCallbackCtx("q:0:0");
      yield* Effect.promise(() => cbHandler(ctx2));
      yield* Effect.sleep(0);
      // Confirm — should fail because nothing selected
      const ctx3 = makeCallbackCtx("qc:0");
      yield* Effect.promise(() => cbHandler(ctx3));
      expect(ctx3.answerCallbackQuery).toHaveBeenCalledWith({
        text: "Select at least one option.",
      });
      expect(questionReplyMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("multi-select confirm with nothing selected shows error", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "question.asked",
        properties: {
          ...sampleQuestion,
          questions: [
            {
              ...sampleQuestion.questions[0],
              multiple: true,
            },
          ],
        },
      });
      yield* Effect.sleep(0);
      const cbHandler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("qc:0");
      yield* Effect.promise(() => cbHandler(ctx));
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
        text: "Select at least one option.",
      });
      expect(questionReplyMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );
});

describe("multi-question flow", () => {
  it.scopedLive("shows questions sequentially and submits all answers", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      // Push a request with 2 questions
      eventRef.current.push({
        type: "question.asked",
        properties: {
          id: "qreq-multi",
          sessionID: "q-session",
          questions: [
            {
              question: "First question",
              header: "Q1",
              options: [
                { label: "A", description: "Option A" },
                { label: "B", description: "Option B" },
              ],
            },
            {
              question: "Second question",
              header: "Q2",
              options: [
                { label: "X", description: "Option X" },
                { label: "Y", description: "Option Y" },
              ],
            },
          ],
        },
      });
      yield* Effect.sleep(0);
      // Answer first question
      const cbHandler = getCallbackQueryHandler();
      formatQuestionMessageMock.mockClear();
      const ctx1 = makeCallbackCtx("q:0:0");
      yield* Effect.promise(() => cbHandler(ctx1));
      yield* Effect.sleep(0);
      // Should not have submitted yet — still need second answer
      expect(questionReplyMock).not.toHaveBeenCalled();
      // Second question should have been sent
      expect(formatQuestionMessageMock).toHaveBeenCalled();
      // Answer second question
      const ctx2 = makeCallbackCtx("q:0:1");
      yield* Effect.promise(() => cbHandler(ctx2));
      yield* Effect.sleep(0);
      // Now should have submitted both answers
      expect(questionReplyMock).toHaveBeenCalledWith({
        requestID: "qreq-multi",
        answers: [["A"], ["Y"]],
      });
    }).pipe(Effect.provide(validFullLayer)),
  );
});

describe("question text answer", () => {
  it.scopedLive("custom text answers the question", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "question.asked",
        properties: sampleQuestion,
      });
      yield* Effect.sleep(0);
      // Send text message as custom answer
      const handler = getMessageHandler();
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 2, text: "my custom answer" },
        }),
      );
      yield* Effect.sleep(0);
      expect(questionReplyMock).toHaveBeenCalledWith({
        requestID: "qreq-1",
        answers: [["my custom answer"]],
      });
      // Should NOT have prompted OpenCode
      expect(sessionPromptAsyncMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("custom text with multi-select includes selected options", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      // Push a multi-select question with custom enabled (default)
      eventRef.current.push({
        type: "question.asked",
        properties: {
          ...sampleQuestion,
          questions: [{ ...sampleQuestion.questions[0], multiple: true }],
        },
      });
      yield* Effect.sleep(0);
      // Select "Yes" option first
      const cbHandler = getCallbackQueryHandler();
      const selectCtx = makeCallbackCtx("q:0:0");
      yield* Effect.promise(() => cbHandler(selectCtx));
      yield* Effect.sleep(0);
      // Now send custom text — should include both selected option and text
      const msgHandler = getMessageHandler();
      yield* Effect.promise(() =>
        msgHandler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 3, text: "extra input" },
        }),
      );
      yield* Effect.sleep(0);
      expect(questionReplyMock).toHaveBeenCalledWith({
        requestID: "qreq-1",
        answers: [["Yes", "extra input"]],
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("custom:false sends pending notification instead", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "question.asked",
        properties: {
          ...sampleQuestion,
          questions: [
            {
              ...sampleQuestion.questions[0],
              custom: false,
            },
          ],
        },
      });
      yield* Effect.sleep(0);
      sendMessageMock.mockClear();
      const handler = getMessageHandler();
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 2, text: "my text" },
        }),
      );
      yield* Effect.sleep(0);
      expect(formatQuestionPendingMock).toHaveBeenCalled();
      expect(questionReplyMock).not.toHaveBeenCalled();
      expect(sessionPromptAsyncMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );
});

describe("question event cleanup", () => {
  it.scopedLive("question.replied cleans up pending state", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "question.asked",
        properties: sampleQuestion,
      });
      yield* Effect.sleep(0);
      editMessageTextMock.mockClear();
      eventRef.current.push({
        type: "question.replied",
        properties: {
          sessionID: "q-session",
          requestID: "qreq-1",
          answers: [["Yes"]],
        },
      });
      yield* Effect.sleep(0);
      expect(editMessageTextMock).toHaveBeenCalled();
      // Callback on expired question should show toast
      const cbHandler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("q:0:0");
      yield* Effect.promise(() => cbHandler(ctx));
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
        text: "The question has expired.",
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("question.rejected cleans up pending state", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "question.asked",
        properties: sampleQuestion,
      });
      yield* Effect.sleep(0);
      editMessageTextMock.mockClear();
      eventRef.current.push({
        type: "question.rejected",
        properties: {
          sessionID: "q-session",
          requestID: "qreq-1",
        },
      });
      yield* Effect.sleep(0);
      expect(editMessageTextMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("question.replied ignores unknown requestId", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      editMessageTextMock.mockClear();
      eventRef.current.push({
        type: "question.replied",
        properties: {
          sessionID: "unknown",
          requestID: "unknown-req",
          answers: [["x"]],
        },
      });
      yield* Effect.sleep(0);
      // No pending question to edit
      expect(editMessageTextMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("question.rejected ignores unknown requestId", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      editMessageTextMock.mockClear();
      eventRef.current.push({
        type: "question.rejected",
        properties: {
          sessionID: "unknown",
          requestID: "unknown-req",
        },
      });
      yield* Effect.sleep(0);
      expect(editMessageTextMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("reconciles pending questions on reconnect", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      // question.list returns a pending question on reconnect
      questionListMock.mockResolvedValueOnce({
        data: [sampleQuestion],
      });
      yield* provideBotLazily;
      // Should have sent the question messages
      expect(formatQuestionMessageMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scoped("clears stale pending questions on reconnect", () => {
    // First reconciliation seeds a pending question via question.list
    questionListMock.mockResolvedValueOnce({
      data: [sampleQuestion],
    });

    // First stream errors immediately to trigger reconnect
    const broken: AsyncIterable<unknown> = {
      [Symbol.asyncIterator]: () => ({
        async next(): Promise<IteratorResult<unknown>> {
          throw new Error("SSE connection lost");
        },
        async return() {
          return { done: true as const, value: undefined };
        },
      }),
    };
    eventSubscribeMock.mockImplementationOnce(async () => ({
      stream: broken,
    }));

    // Seed DB via a layer that runs before Bot.layer
    const seedLayer = Layer.effectDiscard(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* database.session.insert({
          id: "q-session",
          chatId: 123,
          threadId: 0,
          createdAt: undefined,
          updatedAt: undefined,
        });
      }),
    );
    const layerWithSeed = Bot.layer.pipe(
      Layer.provideMerge(seedLayer),
      Layer.provideMerge(validBaseLayer),
    );

    return Effect.gen(function* () {
      yield* Bot;
      // Advance past the 1s reconnect delay
      yield* TestClock.adjust("1 second");

      // Second reconciliation used default question.list (empty data: []).
      // The stale pending question should be cleaned up.
      // Verify by sending a callback for it — should get "expired" toast.
      const handler = getCallbackQueryHandler();
      // Verify the question was added during first reconciliation
      expect(formatQuestionMessageMock).toHaveBeenCalled();
      const ctx = makeCallbackCtx("q:0:0");
      yield* Effect.promise(() => handler(ctx));
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("expired"),
        }),
      );
    }).pipe(Effect.provide(layerWithSeed));
  });

  it.scoped("keeps valid pending questions on reconnect", () => {
    // Both reconciliations return the same question
    questionListMock
      .mockResolvedValueOnce({ data: [sampleQuestion] })
      .mockResolvedValueOnce({ data: [sampleQuestion] });

    const broken: AsyncIterable<unknown> = {
      [Symbol.asyncIterator]: () => ({
        async next(): Promise<IteratorResult<unknown>> {
          throw new Error("SSE connection lost");
        },
        async return() {
          return { done: true as const, value: undefined };
        },
      }),
    };
    eventSubscribeMock.mockImplementationOnce(async () => ({
      stream: broken,
    }));

    const seedLayer = Layer.effectDiscard(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* database.session.insert({
          id: "q-session",
          chatId: 123,
          threadId: 0,
          createdAt: undefined,
          updatedAt: undefined,
        });
      }),
    );
    const layerWithSeed = Bot.layer.pipe(
      Layer.provideMerge(seedLayer),
      Layer.provideMerge(validBaseLayer),
    );

    return Effect.gen(function* () {
      yield* Bot;
      yield* TestClock.adjust("1 second");

      // Question should still be active (not cleaned up).
      // Callback should NOT get "expired" toast.
      const handler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("q:0:0");
      yield* Effect.promise(() => handler(ctx));
      // answerCallbackQuery is called at the end of the handler (not the expired path)
      expect(ctx.answerCallbackQuery).toHaveBeenCalled();
      expect(ctx.answerCallbackQuery).not.toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("expired"),
        }),
      );
    }).pipe(Effect.provide(layerWithSeed));
  });

  it.scopedLive("reconciliation skips questions for unknown sessions", () =>
    Effect.gen(function* () {
      // question.list returns a question for a session not in our DB
      questionListMock.mockResolvedValueOnce({
        data: [{ ...sampleQuestion, sessionID: "nonexistent" }],
      });
      yield* provideBotLazily;
      // Should NOT have sent question messages (session not found)
      expect(formatQuestionMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scopedLive("reconciliation continues when question.list errors", () =>
    Effect.gen(function* () {
      questionListMock.mockResolvedValueOnce({
        data: undefined,
        error: new Error("question list failed"),
      });
      yield* provideBotLazily;
      // Should not crash — question reconciliation logs and continues
      expect(questionListMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scopedLive("/reset rejects only matching session's questions", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "q-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* database.session.insert({
        id: "other-session",
        chatId: 123,
        threadId: 42,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      // Add questions for both sessions
      eventRef.current.push({
        type: "question.asked",
        properties: sampleQuestion,
      });
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "question.asked",
        properties: {
          id: "qreq-other",
          sessionID: "other-session",
          questions: sampleQuestion.questions,
        },
      });
      yield* Effect.sleep(0);
      // Reset only q-session (chatId=123, threadId=0)
      const handler = getCommandHandler("reset");
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "/reset" },
        }),
      );
      yield* Effect.sleep(0);
      // Only q-session's question should be rejected
      expect(questionRejectMock).toHaveBeenCalledWith({
        requestID: "qreq-1",
      });
      expect(questionRejectMock).not.toHaveBeenCalledWith({
        requestID: "qreq-other",
      });
      // Interaction message should be edited to show dismissed text
      expect(editMessageTextMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );
});

// --- Permission helpers ---

const samplePermission = {
  id: "preq-1",
  sessionID: "p-session",
  permission: "bash",
  patterns: ["rm -rf /tmp/*"],
  metadata: {},
  always: [],
};

describe("permission.asked event", () => {
  it.scopedLive("sends permission and interaction messages", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "p-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      sendMessageMock.mockClear();
      eventRef.current.push({
        type: "permission.asked",
        properties: samplePermission,
      });
      yield* Effect.sleep(0);
      // Should send 2 messages: permission content + interaction with keyboard
      expect(formatPermissionMessageMock).toHaveBeenCalled();
      expect(sendMessageMock).toHaveBeenCalledTimes(2);
      // Second message has reply_markup
      const interactionCall = sendMessageMock.mock.calls.at(1);
      assert.isDefined(interactionCall);
      expect(interactionCall[2]).toHaveProperty("reply_markup");
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores permission.asked from unknown session", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      sendMessageMock.mockClear();
      eventRef.current.push({
        type: "permission.asked",
        properties: samplePermission,
      });
      yield* Effect.sleep(0);
      expect(formatPermissionMessageMock).not.toHaveBeenCalled();
      expect(sendMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );
});

describe("permission callback", () => {
  it.scopedLive("allow once calls permission.reply with 'once'", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "p-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      sendMessageMock.mockClear();
      eventRef.current.push({
        type: "permission.asked",
        properties: samplePermission,
      });
      yield* Effect.sleep(0);
      const cbHandler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("p:p0:once");
      yield* Effect.promise(() => cbHandler(ctx));
      yield* Effect.sleep(0);
      expect(permissionReplyMock).toHaveBeenCalledWith({
        requestID: "preq-1",
        reply: "once",
      });
      expect(editMessageTextMock).toHaveBeenCalled();
      expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("always allow calls permission.reply with 'always'", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "p-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      sendMessageMock.mockClear();
      eventRef.current.push({
        type: "permission.asked",
        properties: samplePermission,
      });
      yield* Effect.sleep(0);
      const cbHandler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("p:p0:always");
      yield* Effect.promise(() => cbHandler(ctx));
      yield* Effect.sleep(0);
      expect(permissionReplyMock).toHaveBeenCalledWith({
        requestID: "preq-1",
        reply: "always",
      });
      expect(editMessageTextMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("deny calls permission.reply with 'reject'", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "p-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      sendMessageMock.mockClear();
      eventRef.current.push({
        type: "permission.asked",
        properties: samplePermission,
      });
      yield* Effect.sleep(0);
      const cbHandler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("pr:p0");
      yield* Effect.promise(() => cbHandler(ctx));
      yield* Effect.sleep(0);
      expect(permissionReplyMock).toHaveBeenCalledWith({
        requestID: "preq-1",
        reply: "reject",
      });
      expect(editMessageTextMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("expired permission callback returns toast", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const cbHandler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("p:p99:once");
      yield* Effect.promise(() => cbHandler(ctx));
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
        text: "The permission request has expired.",
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("ignores malformed permission reply value", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "p-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "permission.asked",
        properties: samplePermission,
      });
      yield* Effect.sleep(0);
      const cbHandler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("p:p0:garbage");
      yield* Effect.promise(() => cbHandler(ctx));
      yield* Effect.sleep(0);
      // Should dismiss the button spinner but not call permission.reply
      expect(ctx.answerCallbackQuery).toHaveBeenCalled();
      expect(permissionReplyMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );
});

describe("permission event cleanup", () => {
  it.scopedLive("permission.replied cleans up pending state", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "p-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "permission.asked",
        properties: samplePermission,
      });
      yield* Effect.sleep(0);
      editMessageTextMock.mockClear();
      eventRef.current.push({
        type: "permission.replied",
        properties: {
          sessionID: "p-session",
          requestID: "preq-1",
          reply: "once",
        },
      });
      yield* Effect.sleep(0);
      expect(editMessageTextMock).toHaveBeenCalled();
      // Callback on expired permission should show toast
      const cbHandler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("p:p0:once");
      yield* Effect.promise(() => cbHandler(ctx));
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
        text: "The permission request has expired.",
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("permission.replied ignores unknown requestId", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      editMessageTextMock.mockClear();
      eventRef.current.push({
        type: "permission.replied",
        properties: {
          sessionID: "unknown",
          requestID: "unknown-req",
          reply: "once",
        },
      });
      yield* Effect.sleep(0);
      expect(editMessageTextMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("reconciles pending permissions on reconnect", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "p-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      permissionListMock.mockResolvedValueOnce({
        data: [samplePermission],
      });
      yield* provideBotLazily;
      expect(formatPermissionMessageMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scopedLive("/reset rejects pending permissions", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "p-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "permission.asked",
        properties: samplePermission,
      });
      yield* Effect.sleep(0);
      const handler = getCommandHandler("reset");
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "/reset" },
        }),
      );
      yield* Effect.sleep(0);
      expect(permissionReplyMock).toHaveBeenCalledWith({
        requestID: "preq-1",
        reply: "reject",
      });
      expect(editMessageTextMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scopedLive("handles non-zero threadId for permissions", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "p-session",
        chatId: 123,
        threadId: 42,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      sendMessageMock.mockClear();
      eventRef.current.push({
        type: "permission.asked",
        properties: samplePermission,
      });
      yield* Effect.sleep(0);
      expect(sendMessageMock).toHaveBeenCalledTimes(2);
      // Second message should include message_thread_id
      const interactionCall = sendMessageMock.mock.calls.at(1);
      assert.isDefined(interactionCall);
      expect(interactionCall[2]).toHaveProperty("message_thread_id", 42);
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scoped("keeps valid pending permissions on reconnect", () => {
    // Both reconciliations return the same permission
    permissionListMock
      .mockResolvedValueOnce({ data: [samplePermission] })
      .mockResolvedValueOnce({ data: [samplePermission] });

    const broken: AsyncIterable<unknown> = {
      [Symbol.asyncIterator]: () => ({
        async next(): Promise<IteratorResult<unknown>> {
          throw new Error("SSE connection lost");
        },
        async return() {
          return { done: true as const, value: undefined };
        },
      }),
    };
    eventSubscribeMock.mockImplementationOnce(async () => ({
      stream: broken,
    }));

    const seedLayer = Layer.effectDiscard(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* database.session.insert({
          id: "p-session",
          chatId: 123,
          threadId: 0,
          createdAt: undefined,
          updatedAt: undefined,
        });
      }),
    );
    const layerWithSeed = Bot.layer.pipe(
      Layer.provideMerge(seedLayer),
      Layer.provideMerge(validBaseLayer),
    );

    return Effect.gen(function* () {
      yield* Bot;
      yield* TestClock.adjust("1 second");

      // Permission should still be active (not cleaned up).
      const handler = getCallbackQueryHandler();
      const ctx = makeCallbackCtx("p:p0:once");
      yield* Effect.promise(() => handler(ctx));
      // answerCallbackQuery is called at the end (not the expired path)
      expect(ctx.answerCallbackQuery).toHaveBeenCalled();
      expect(ctx.answerCallbackQuery).not.toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("expired"),
        }),
      );
    }).pipe(Effect.provide(layerWithSeed));
  });

  it.scopedLive("reconciliation skips permissions for unknown sessions", () =>
    Effect.gen(function* () {
      permissionListMock.mockResolvedValueOnce({
        data: [{ ...samplePermission, sessionID: "nonexistent" }],
      });
      yield* provideBotLazily;
      expect(formatPermissionMessageMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scopedLive("/reset rejects only matching session's permissions", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "p-session",
        chatId: 123,
        threadId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* database.session.insert({
        id: "other-session",
        chatId: 123,
        threadId: 42,
        createdAt: undefined,
        updatedAt: undefined,
      });
      yield* Bot;
      yield* Effect.sleep(0);
      // Add permissions for both sessions
      eventRef.current.push({
        type: "permission.asked",
        properties: samplePermission,
      });
      yield* Effect.sleep(0);
      eventRef.current.push({
        type: "permission.asked",
        properties: {
          ...samplePermission,
          id: "preq-other",
          sessionID: "other-session",
        },
      });
      yield* Effect.sleep(0);
      // Reset only p-session (chatId=123, threadId=0)
      const handler = getCommandHandler("reset");
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "/reset" },
        }),
      );
      yield* Effect.sleep(0);
      expect(permissionReplyMock).toHaveBeenCalledWith({
        requestID: "preq-1",
        reply: "reject",
      });
      expect(permissionReplyMock).not.toHaveBeenCalledWith({
        requestID: "preq-other",
        reply: "reject",
      });
    }).pipe(Effect.provide(validFullLayer)),
  );

  it.scoped("clears stale pending permissions on reconnect", () => {
    // First reconciliation seeds a pending permission via permission.list
    permissionListMock.mockResolvedValueOnce({
      data: [samplePermission],
    });

    // First stream errors immediately to trigger reconnect
    const broken: AsyncIterable<unknown> = {
      [Symbol.asyncIterator]: () => ({
        async next(): Promise<IteratorResult<unknown>> {
          throw new Error("SSE connection lost");
        },
        async return() {
          return { done: true as const, value: undefined };
        },
      }),
    };
    eventSubscribeMock.mockImplementationOnce(async () => ({
      stream: broken,
    }));

    const seedLayer = Layer.effectDiscard(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* database.session.insert({
          id: "p-session",
          chatId: 123,
          threadId: 0,
          createdAt: undefined,
          updatedAt: undefined,
        });
      }),
    );
    const layerWithSeed = Bot.layer.pipe(
      Layer.provideMerge(seedLayer),
      Layer.provideMerge(validBaseLayer),
    );

    return Effect.gen(function* () {
      yield* Bot;
      // Advance past the 1s reconnect delay
      yield* TestClock.adjust("1 second");

      // Second reconciliation used default permission.list (empty data: []).
      // The stale pending permission should be cleaned up.
      // Verify by sending a callback for it — should get "expired" toast.
      const handler = getCallbackQueryHandler();
      expect(formatPermissionMessageMock).toHaveBeenCalled();
      const ctx = makeCallbackCtx("p:p0:once");
      yield* Effect.promise(() => handler(ctx));
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("expired"),
        }),
      );
    }).pipe(Effect.provide(layerWithSeed));
  });

  it.scopedLive("reconciliation continues when permission.list errors", () =>
    Effect.gen(function* () {
      permissionListMock.mockResolvedValueOnce({
        data: undefined,
        error: new Error("permission list failed"),
      });
      yield* provideBotLazily;
      expect(permissionListMock).toHaveBeenCalled();
    }).pipe(Effect.provide(validBaseLayer)),
  );

  it.scopedLive(
    "text message while permission is pending sends notification",
    () =>
      Effect.gen(function* () {
        const database = yield* Database;
        yield* database.session.insert({
          id: "p-session",
          chatId: 123,
          threadId: 0,
          createdAt: undefined,
          updatedAt: undefined,
        });
        yield* Bot;
        yield* Effect.sleep(0);
        eventRef.current.push({
          type: "permission.asked",
          properties: samplePermission,
        });
        yield* Effect.sleep(0);
        sendMessageMock.mockClear();
        const handler = getMessageHandler();
        yield* Effect.promise(() =>
          handler({
            from: { id: 123 },
            chat: { id: 123 },
            message: { message_id: 2, text: "hello" },
          }),
        );
        yield* Effect.sleep(0);
        expect(formatPermissionPendingMock).toHaveBeenCalled();
        expect(sendMessageMock).toHaveBeenCalled();
        // Should NOT have prompted OpenCode
        expect(sessionPromptAsyncMock).not.toHaveBeenCalled();
      }).pipe(Effect.provide(validFullLayer)),
  );
});
