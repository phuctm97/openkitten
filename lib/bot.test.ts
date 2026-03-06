import { expect, mock, spyOn, test } from "bun:test";
import { ConfigProvider, Effect, Layer } from "effect";
import { Bot } from "~/lib/bot";

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
}

mock.module("grammy", () => ({ Bot: GrammyBot }));

const startSpy = spyOn(GrammyBot.prototype, "start");

const stopSpy = spyOn(GrammyBot.prototype, "stop");

const validConfigLayer = Layer.setConfigProvider(
  ConfigProvider.fromJson({ TELEGRAM_BOT_TOKEN: "test:fake-token" }),
);

const validBotLayer = Layer.provideMerge(Bot.layer, validConfigLayer);

test("layer calls start on acquire and stop on release", async () => {
  await Effect.gen(function* () {
    yield* Bot;
    yield* Effect.sleep(0);
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(stopSpy).not.toHaveBeenCalled();
  }).pipe(Effect.provide(validBotLayer), Effect.scoped, Effect.runPromise);
  expect(stopSpy).toHaveBeenCalledTimes(1);
});

const invalidConfigLayer = Layer.setConfigProvider(ConfigProvider.fromJson({}));

const invalidBotLayer = Layer.provideMerge(Bot.layer, invalidConfigLayer);

test("layer fails without TELEGRAM_BOT_TOKEN", () =>
  expect(
    Bot.pipe(Effect.provide(invalidBotLayer), Effect.scoped, Effect.runPromise),
  ).rejects.toThrow());
