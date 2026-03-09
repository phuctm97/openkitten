import { Effect, Layer } from "effect";
import { Bot } from "~/lib/bot";

export const botLayer = Layer.effect(
  Bot,
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(Effect.never);
    return Bot.of({ fiber });
  }),
);
