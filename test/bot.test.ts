import { assert, describe, expect, it } from "@effect/vitest";
import { Cause, ConfigProvider, Effect, Layer, Option, Runtime } from "effect";
import { beforeEach, vi } from "vitest";
import { Bot } from "~/lib/bot";
import { Database } from "~/lib/database";
import { defaultLayer } from "~/test/default-layer";
import { opencodeLayer } from "~/test/opencode-layer";

// --- Types for grammY mock ---

interface GrammyBotContext {
  from?: { id: number };
  chat?: { id: number };
  message?: { message_id: number; text: string };
}

type GrammyErrorHandler = (err: {
  error: unknown;
  ctx: GrammyBotContext;
}) => Promise<unknown>;

type GrammyEventHandler = (ctx: GrammyBotContext) => Promise<unknown>;

interface GrammyStartOptions {
  onStart?: () => void;
}

// --- Mock grammY bot and SSE event stream ---
// Must be in vi.hoisted() so vi.mock() can reference them at module scope.
const { GrammyBot, sendMessageMock, eventRef, createEventController } =
  vi.hoisted(() => {
    const sendMessageMock = vi.fn().mockResolvedValue(undefined);

    class GrammyBot {
      api = { sendMessage: sendMessageMock };
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

    return { GrammyBot, sendMessageMock, eventRef, createEventController };
  });

vi.mock("grammy", () => ({ Bot: GrammyBot }));

const startSpy = vi.spyOn(GrammyBot.prototype, "start");
const stopSpy = vi.spyOn(GrammyBot.prototype, "stop");
const onSpy = vi.spyOn(GrammyBot.prototype, "on");
const catchSpy = vi.spyOn(GrammyBot.prototype, "catch");

const sessionCreateMock = vi.fn().mockResolvedValue({
  data: { id: "new-session-id" },
});

// Default mock: immediately pushes a completed assistant message event so the
// event stream fiber processes the reply without delay. Individual tests
// override this when they need different behavior (errors, empty parts, etc.).
const sessionPromptAsyncMock = vi
  .fn()
  .mockImplementation(async (args: { sessionID: string }) => {
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

const sessionMessageMock = vi.fn().mockResolvedValue({
  data: {
    info: { id: "msg-1", role: "assistant" },
    parts: [{ type: "text", text: "AI response" }],
  },
});

// Exposed as a spy so tests can override with broken streams for reconnect tests
const eventSubscribeMock = vi
  .fn()
  .mockImplementation(async () => ({ stream: eventRef.current.stream() }));

vi.mock("@opencode-ai/sdk/v2/client", () => ({
  createOpencodeClient: () => ({
    session: {
      create: sessionCreateMock,
      promptAsync: sessionPromptAsyncMock,
      message: sessionMessageMock,
    },
    event: {
      subscribe: eventSubscribeMock,
    },
  }),
}));

const { formatErrorMock, formatMessageMock } = vi.hoisted(() => ({
  formatErrorMock: vi
    .fn()
    .mockReturnValue([{ text: "raw error", markdown: "formatted error" }]),
  formatMessageMock: vi
    .fn()
    .mockReturnValue([{ text: "AI response", markdown: "AI response" }]),
}));

vi.mock("~/lib/format-error", () => ({
  formatError: formatErrorMock,
}));

vi.mock("~/lib/format-message", () => ({
  formatMessage: formatMessageMock,
}));

// --- Test setup ---

// Each test gets a fresh event stream and sendMessage mock so state doesn't leak
beforeEach(() => {
  eventRef.current = createEventController();
  sendMessageMock.mockClear();
});

function makeLayer(config: Record<string, unknown>) {
  return Bot.layer.pipe(
    Layer.provideMerge(
      Layer.setConfigProvider(ConfigProvider.fromJson(config)),
    ),
    Layer.provideMerge(opencodeLayer),
    Layer.provideMerge(defaultLayer),
  );
}

const validLayer = makeLayer({
  TELEGRAM_BOT_TOKEN: "test:fake-token",
  TELEGRAM_USER_ID: 123,
});

describe("layer", () => {
  it.live("calls start on acquire and stop on release", () =>
    Effect.gen(function* () {
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Bot;
          yield* Effect.sleep(0);
          expect(startSpy).toHaveBeenCalledTimes(1);
          expect(stopSpy).not.toHaveBeenCalled();
        }).pipe(Effect.provide(validLayer)),
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
        }).pipe(Effect.provide(validLayer)),
      );
    }),
  );

  it.scopedLive.fails("dies when start rejects", () => {
    startSpy.mockRejectedValueOnce(new Error("start failed"));
    return Effect.gen(function* () {
      const { fiber } = yield* Bot;
      yield* fiber;
    }).pipe(Effect.provide(validLayer));
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
    }).pipe(Effect.provide(validLayer)),
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
      expect(sessionPromptAsyncMock).toHaveBeenCalledWith({
        sessionID: "new-session-id",
        parts: [{ type: "text", text: "hello" }],
      });
      expect(sendMessageMock).toHaveBeenCalledWith(123, expect.any(String), {
        parse_mode: "MarkdownV2",
      });
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("reuses existing session", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.profile.insert({
        id: "default",
        activeSessionId: Option.some("existing-session-id"),
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
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("updates profile when it exists without active session", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.profile.insert({
        id: "default",
        activeSessionId: Option.none(),
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
      expect(sessionCreateMock).toHaveBeenCalledWith({});
      expect(sendMessageMock).toHaveBeenCalledWith(123, expect.any(String), {
        parse_mode: "MarkdownV2",
      });
      const profile = yield* database.profile.findById("default");
      assert.isTrue(Option.isSome(profile));
      expect(Option.getOrThrow(profile).activeSessionId).toEqual(
        Option.some("new-session-id"),
      );
    }).pipe(Effect.provide(validLayer)),
  );

  // Error tests use Effect.promise(async () => expect(...).rejects.toThrow())
  // instead of it.scopedLive.fails because we need post-failure assertions
  // (e.g. reply not called), which .fails doesn't support.
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
    }).pipe(Effect.provide(validLayer)),
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
    }).pipe(Effect.provide(validLayer)),
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
    }).pipe(Effect.provide(validLayer)),
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
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("ignores events for unknown sessions", () =>
    Effect.gen(function* () {
      sessionPromptAsyncMock.mockImplementationOnce(
        async (args: { sessionID: string }) => {
          // Push events for a session that has no pending entry
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
    }).pipe(Effect.provide(validLayer)),
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
    }).pipe(Effect.provide(validLayer)),
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
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("does not reply when response has no text parts", () =>
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
    }).pipe(Effect.provide(validLayer)),
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
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("sends plain text reply for unformatted chunk", () =>
    Effect.gen(function* () {
      formatMessageMock.mockReturnValueOnce([{ text: "plain reply" }]);
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
      expect(sendMessageMock).toHaveBeenCalledWith(123, "plain reply");
    }).pipe(Effect.provide(validLayer)),
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
      // Fallback call: sendMessage(chatId, text) — no parse_mode
      expect(fallbackCall[2]).toBeUndefined();
    }).pipe(Effect.provide(validLayer)),
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
    }).pipe(Effect.provide(validLayer)),
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
    }).pipe(Effect.provide(validLayer)),
  );

  // Verifies that when the SSE stream errors, the bot reconnects and
  // continues processing events on the new connection.
  it.scopedLive(
    "reconnects event stream after error",
    () => {
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
        // Wait for reconnect delay (5s) + margin for the second subscribe
        yield* Effect.sleep("6 seconds");

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
        yield* Effect.sleep(0);
        expect(sendMessageMock).toHaveBeenCalled();
      }).pipe(Effect.provide(validLayer));
    },
    { timeout: 10_000 },
  );

  it.scopedLive("continues event stream after processEvent defect", () =>
    Effect.gen(function* () {
      // First call rejects (defect), second call uses the default mock
      sessionMessageMock.mockRejectedValueOnce(new Error("network error"));
      sessionPromptAsyncMock.mockImplementationOnce(
        async (args: { sessionID: string }) => {
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
    }).pipe(Effect.provide(validLayer)),
  );
});
