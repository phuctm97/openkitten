import { assert, describe, expect, it } from "@effect/vitest";
import { Cause, ConfigProvider, Effect, Layer, Option, Runtime } from "effect";
import { vi } from "vitest";
import { Bot } from "~/lib/bot";
import { Database } from "~/lib/database";
import { defaultLayer } from "~/test/default-layer";

interface GrammyBotContext {
  from?: { id: number };
  chat?: { id: number };
  message?: { message_id: number; text: string };
  reply: ReturnType<typeof vi.fn>;
}

type GrammyEventHandler = (ctx: GrammyBotContext) => Promise<unknown>;

type GrammyErrorHandler = (err: {
  error: unknown;
  ctx: GrammyBotContext;
}) => Promise<unknown>;

interface GrammyStartOptions {
  onStart?: () => void;
}

const { GrammyBot } = vi.hoisted(() => {
  class GrammyBot {
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
    on(_event: string, _callback: GrammyEventHandler) {}
    catch(_handler: GrammyErrorHandler) {}
  }
  return { GrammyBot };
});

vi.mock("grammy", () => ({ Bot: GrammyBot }));

const startSpy = vi.spyOn(GrammyBot.prototype, "start");

const stopSpy = vi.spyOn(GrammyBot.prototype, "stop");

const onSpy = vi.spyOn(GrammyBot.prototype, "on");

const catchSpy = vi.spyOn(GrammyBot.prototype, "catch");

const sessionCreateMock = vi.fn().mockResolvedValue({
  data: { id: "new-session-id" },
});

const sessionPromptMock = vi.fn().mockResolvedValue({
  data: { parts: [{ type: "text", text: "AI response" }] },
});

vi.mock("@opencode-ai/sdk/v2/client", () => ({
  createOpencodeClient: () => ({
    session: {
      create: sessionCreateMock,
      prompt: sessionPromptMock,
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

function makeLayer(config: Record<string, unknown>) {
  return Bot.layer.pipe(
    Layer.provideMerge(
      Layer.setConfigProvider(ConfigProvider.fromJson(config)),
    ),
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
      const reply = vi.fn().mockResolvedValue(undefined);
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
          reply,
        }),
      );
      expect(sessionCreateMock).toHaveBeenCalledWith({});
      expect(sessionPromptMock).toHaveBeenCalledWith({
        sessionID: "new-session-id",
        parts: [{ type: "text", text: "hello" }],
      });
      expect(reply).toHaveBeenCalledWith(expect.any(String), {
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
      const reply = vi.fn().mockResolvedValue(undefined);
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
          reply,
        }),
      );
      expect(sessionCreateMock).not.toHaveBeenCalled();
      expect(sessionPromptMock).toHaveBeenCalledWith({
        sessionID: "existing-session-id",
        parts: [{ type: "text", text: "hello" }],
      });
      expect(reply).toHaveBeenCalledWith(expect.any(String), {
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
      const reply = vi.fn().mockResolvedValue(undefined);
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
          reply,
        }),
      );
      expect(sessionCreateMock).toHaveBeenCalledWith({});
      expect(reply).toHaveBeenCalledWith(expect.any(String), {
        parse_mode: "MarkdownV2",
      });
      const profile = yield* database.profile.findById("default");
      assert.isTrue(Option.isSome(profile));
      expect(Option.getOrThrow(profile).activeSessionId).toEqual(
        Option.some("new-session-id"),
      );
    }).pipe(Effect.provide(validLayer)),
  );

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
      const reply = vi.fn().mockResolvedValue(undefined);
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
          reply,
        }).catch(() => {}),
      );
      expect(reply).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("dies when session prompt returns error", () =>
    Effect.gen(function* () {
      sessionPromptMock.mockResolvedValueOnce({
        data: undefined,
        error: new Error("prompt failed"),
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      const reply = vi.fn().mockResolvedValue(undefined);
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
          reply,
        }).catch(() => {}),
      );
      expect(reply).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("does not reply when response has no text parts", () =>
    Effect.gen(function* () {
      sessionPromptMock.mockResolvedValueOnce({
        data: { parts: [{ type: "tool" }] },
      });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      const reply = vi.fn().mockResolvedValue(undefined);
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
          reply,
        }),
      );
      expect(reply).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("ignores messages from unauthorized user", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      const reply = vi.fn().mockResolvedValue(undefined);
      yield* Effect.promise(() =>
        handler({
          from: { id: 999 },
          chat: { id: 999 },
          message: { message_id: 1, text: "hello" },
          reply,
        }),
      );
      expect(reply).not.toHaveBeenCalled();
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
      const reply = vi.fn().mockResolvedValue(undefined);
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
          reply,
        }),
      );
      expect(reply).toHaveBeenCalledTimes(1);
      expect(reply).toHaveBeenCalledWith("plain reply");
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("falls back to plain text reply when MarkdownV2 fails", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      const reply = vi
        .fn()
        .mockRejectedValueOnce(new Error("parse error"))
        .mockResolvedValue(undefined);
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          chat: { id: 123 },
          message: { message_id: 1, text: "hello" },
          reply,
        }),
      );
      expect(reply).toHaveBeenCalledTimes(2);
      const fallbackCall = reply.mock.calls.at(1);
      assert.isDefined(fallbackCall);
      expect(fallbackCall[1]).toBeUndefined();
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("sends formatted error on catch", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = catchSpy.mock.lastCall;
      assert.isDefined(call);
      const errorHandler = call[0];
      const reply = vi.fn().mockResolvedValue(undefined);
      yield* Effect.promise(() =>
        errorHandler({
          error: new Error("test error"),
          ctx: { chat: { id: 123 }, reply },
        }),
      );
      expect(reply).toHaveBeenCalled();
      const firstCall = reply.mock.calls.at(0);
      assert.isDefined(firstCall);
      expect(firstCall[0]).toContain("error");
      expect(firstCall[1]).toEqual({ parse_mode: "MarkdownV2" });
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("unwraps FiberFailure before formatting", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = catchSpy.mock.lastCall;
      assert.isDefined(call);
      const errorHandler = call[0];
      const reply = vi.fn().mockResolvedValue(undefined);
      const fiberFailure = Runtime.makeFiberFailure(
        Cause.die(new Error("wrapped error")),
      );
      yield* Effect.promise(() =>
        errorHandler({
          error: fiberFailure,
          ctx: { chat: { id: 123 }, reply },
        }),
      );
      expect(formatErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: "wrapped error" }),
      );
    }).pipe(Effect.provide(validLayer)),
  );
});
