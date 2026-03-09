import { Effect, Layer } from "effect";
import { Bot as GrammyBot } from "grammy";
import { Bot } from "~/lib/bot";

export const botLayer = Layer.effect(
  Bot,
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(Effect.never);
    return Bot.of({ fiber, client: new GrammyBot("0:test") });
  }),
);
