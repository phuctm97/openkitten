import { describe, expect, mock, spyOn, test } from "bun:test";
import { ConfigProvider, Effect, Layer } from "effect";
import { Bot } from "~/lib/bot";
import { expectToBeDefined } from "~/lib/expect-to-be-defined";
import pkg from "~/package.json" with { type: "json" };

type GrammyHandler = (ctx: unknown) => Promise<unknown>;

class GrammyBot {
  private resolve?: () => void;
  async start() {
    return new Promise<void>((resolve) => {
      this.resolve = resolve;
    });
  }
  async stop() {
    this.resolve?.();
  }
  on(_event: string, _handler: GrammyHandler) {}
}

mock.module("grammy", () => ({ Bot: GrammyBot }));

const startSpy = spyOn(GrammyBot.prototype, "start");

const stopSpy = spyOn(GrammyBot.prototype, "stop");

const onSpy = spyOn(GrammyBot.prototype, "on");

const validConfigLayer = Layer.setConfigProvider(
  ConfigProvider.fromJson({
    TELEGRAM_BOT_TOKEN: "test:fake-token",
    TELEGRAM_USER_ID: 123,
  }),
);

const validBotLayer = Layer.provideMerge(Bot.layer, validConfigLayer);

describe("layer", () => {
  test("calls start on acquire and stop on release", async () => {
    await Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(stopSpy).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validBotLayer), Effect.scoped, Effect.runPromise);
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  const missingBotTokenConfigLayer = Layer.setConfigProvider(
    ConfigProvider.fromJson({}),
  );

  const missingBotTokenBotLayer = Layer.provideMerge(
    Bot.layer,
    missingBotTokenConfigLayer,
  );

  test("fails without TELEGRAM_BOT_TOKEN", () =>
    expect(
      Bot.pipe(
        Effect.provide(missingBotTokenBotLayer),
        Effect.scoped,
        Effect.runPromise,
      ),
    ).rejects.toThrow());

  const missingUserIdConfigLayer = Layer.setConfigProvider(
    ConfigProvider.fromJson({ TELEGRAM_BOT_TOKEN: "test:fake-token" }),
  );

  const missingUserIdBotLayer = Layer.provideMerge(
    Bot.layer,
    missingUserIdConfigLayer,
  );

  test("fails without TELEGRAM_USER_ID", () =>
    expect(
      Bot.pipe(
        Effect.provide(missingUserIdBotLayer),
        Effect.scoped,
        Effect.runPromise,
      ),
    ).rejects.toThrow());
});

describe("handler", () => {
  test("is registered before start", async () => {
    await Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      expect(onSpy).toHaveBeenCalledWith("message:text", expect.any(Function));
      const onOrder = onSpy.mock.invocationCallOrder.at(0);
      const startOrder = startSpy.mock.invocationCallOrder.at(0);
      expectToBeDefined(onOrder);
      expectToBeDefined(startOrder);
      expect(onOrder).toBeLessThan(startOrder);
    }).pipe(Effect.provide(validBotLayer), Effect.scoped, Effect.runPromise);
  });

  test("replies with prefixed text for authorized user", async () => {
    const reply = mock();
    await Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.calls.at(0);
      expectToBeDefined(call);
      const handler = call[1];
      yield* Effect.promise(async () =>
        handler({
          from: { id: 123 },
          message: { text: "hello" },
          reply,
        }),
      );
      expect(reply).toHaveBeenCalledWith(`[${pkg.name}] hello`);
    }).pipe(Effect.provide(validBotLayer), Effect.scoped, Effect.runPromise);
  });

  test("ignores messages from unauthorized user", async () => {
    const reply = mock();
    await Effect.gen(function* () {
      yield* Bot;
      yield* Effect.sleep(0);
      const call = onSpy.mock.calls.at(0);
      expectToBeDefined(call);
      const handler = call[1];
      yield* Effect.promise(async () =>
        handler({
          from: { id: 999 },
          message: { text: "hello" },
          reply,
        }),
      );
      expect(reply).not.toHaveBeenCalled();
    }).pipe(Effect.provide(validBotLayer), Effect.scoped, Effect.runPromise);
  });
});
