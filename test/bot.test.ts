import { BunContext } from "@effect/platform-bun";
import { assert, describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Logger, Option } from "effect";
import { vi } from "vitest";
import { Bot } from "~/lib/bot";
import { Database } from "~/lib/database";
import { makeDatabaseLayer } from "~/lib/make-database-layer";
import { OpenCode } from "~/lib/opencode";

type GrammyEventHandler = (ctx: unknown) => Promise<unknown>;

type GrammyErrorHandler = (err: { error: unknown }) => Promise<unknown>;

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

const startSpy = vi.spyOn(GrammyBot.prototype, "start");

const stopSpy = vi.spyOn(GrammyBot.prototype, "stop");

const onSpy = vi.spyOn(GrammyBot.prototype, "on");

const catchSpy = vi.spyOn(GrammyBot.prototype, "catch");

const openCodeLayer = Layer.effect(
  OpenCode,
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(Effect.never);
    return { fiber, port: 4096 };
  }),
);

function makeLayer(config: Record<string, unknown>) {
  return Bot.layer.pipe(
    Layer.provideMerge(openCodeLayer),
    Layer.provideMerge(makeDatabaseLayer()),
    Layer.provideMerge(
      Layer.setConfigProvider(ConfigProvider.fromJson(config)),
    ),
    Layer.provideMerge(BunContext.layer),
    Layer.provideMerge(Logger.replace(Logger.defaultLogger, Logger.none)),
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
          message: { text: "hello" },
          reply,
        }),
      );
      expect(sessionCreateMock).toHaveBeenCalledWith({});
      expect(sessionPromptMock).toHaveBeenCalledWith({
        sessionID: "new-session-id",
        parts: [{ type: "text", text: "hello" }],
      });
      expect(reply).toHaveBeenCalledWith("AI response");
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
          message: { text: "hello" },
          reply,
        }),
      );
      expect(sessionCreateMock).not.toHaveBeenCalled();
      expect(sessionPromptMock).toHaveBeenCalledWith({
        sessionID: "existing-session-id",
        parts: [{ type: "text", text: "hello" }],
      });
      expect(reply).toHaveBeenCalledWith("AI response");
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
          message: { text: "hello" },
          reply,
        }),
      );
      expect(sessionCreateMock).toHaveBeenCalledWith({});
      expect(reply).toHaveBeenCalledWith("AI response");
      const profile = yield* database.profile.findById("default");
      assert.isTrue(Option.isSome(profile));
      expect(Option.getOrThrow(profile).activeSessionId).toEqual(
        Option.some("new-session-id"),
      );
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("dies when session create returns no data", () =>
    Effect.gen(function* () {
      sessionCreateMock.mockResolvedValueOnce({ data: undefined });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      const reply = vi.fn().mockResolvedValue(undefined);
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          message: { text: "hello" },
          reply,
        }).catch(() => {}),
      );
      expect(reply).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("dies when session prompt returns no data", () =>
    Effect.gen(function* () {
      sessionPromptMock.mockResolvedValueOnce({ data: undefined });
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      const reply = vi.fn().mockResolvedValue(undefined);
      yield* Effect.promise(() =>
        handler({
          from: { id: 123 },
          message: { text: "hello" },
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
          message: { text: "hello" },
          reply,
        }),
      );
      expect(reply).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validLayer)),
  );

  it.scopedLive("ignores messages from unauthorized user", () => {
    const reply = vi.fn();
    return Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.lastCall;
      assert.isDefined(call);
      const handler = call[1];
      handler({
        from: { id: 999 },
        message: { text: "hello" },
        reply,
      });
      expect(reply).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validLayer));
  });

  it.scopedLive("registers error handler", () =>
    Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = catchSpy.mock.lastCall;
      assert.isDefined(call);
      const errorHandler = call[0];
      yield* Effect.promise(() =>
        errorHandler({ error: new Error("test error") }),
      );
    }).pipe(Effect.provide(validLayer)),
  );
});
