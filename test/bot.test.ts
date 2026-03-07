import { assert, describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Logger } from "effect";
import { vi } from "vitest";
import { Bot } from "~/lib/bot";
import { OpenCode } from "~/lib/opencode";
import pkg from "~/package.json" with { type: "json" };

type GrammyEventHandler = (ctx: unknown) => Promise<unknown>;

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
  }
  return { GrammyBot };
});

vi.mock("grammy", () => ({ Bot: GrammyBot }));

const sessionListMock = vi.fn().mockResolvedValue({ data: [] });

vi.mock("@opencode-ai/sdk/v2/client", () => ({
  createOpencodeClient: () => ({ session: { list: sessionListMock } }),
}));

const startSpy = vi.spyOn(GrammyBot.prototype, "start");

const stopSpy = vi.spyOn(GrammyBot.prototype, "stop");

const onSpy = vi.spyOn(GrammyBot.prototype, "on");

const openCodeLayer = Layer.effect(
  OpenCode,
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(Effect.never);
    return { fiber, port: 4096 };
  }),
);

function makeLayer(config: Record<string, unknown>) {
  return Layer.provideMerge(
    Bot.layer,
    Layer.mergeAll(
      Layer.setConfigProvider(ConfigProvider.fromJson(config)),
      Logger.replace(Logger.defaultLogger, Logger.none),
      openCodeLayer,
    ),
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

  it.scopedLive("replies with prefixed text for authorized user", () => {
    const reply = vi.fn();
    return Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.calls.at(0);
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(async () =>
        handler({
          from: { id: 123 },
          message: { text: "hello" },
          reply,
        }),
      );
      expect(reply).toHaveBeenCalledWith(`[${pkg.name}] hello`);
    }).pipe(Effect.provide(validLayer));
  });

  it.scopedLive("ignores messages from unauthorized user", () => {
    const reply = vi.fn();
    return Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.calls.at(0);
      assert.isDefined(call);
      const handler = call[1];
      yield* Effect.promise(async () =>
        handler({
          from: { id: 999 },
          message: { text: "hello" },
          reply,
        }),
      );
      expect(reply).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validLayer));
  });
});
