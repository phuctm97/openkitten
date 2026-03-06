import { Command, Span } from "@effect/cli";
import { Effect, Fiber } from "effect";
import { Bot } from "~/lib/bot";
import { Scripts } from "~/lib/scripts";
import pkg from "~/package.json" with { type: "json" };

const serve = Command.make("serve", {}, () =>
  Effect.gen(function* () {
    const bot = yield* Bot;
    return yield* Fiber.join(bot.fiber);
  }),
).pipe(Command.withDescription("Start the OpenKitten server."));

const up = Command.make("up", {}, () =>
  Effect.gen(function* () {
    const scripts = yield* Scripts;
    yield* Effect.promise(() => scripts.up());
  }),
).pipe(
  Command.withDescription("Install and update OpenKitten as a system service."),
);

const down = Command.make("down", {}, () =>
  Effect.gen(function* () {
    const scripts = yield* Scripts;
    yield* Effect.promise(() => scripts.down());
  }),
).pipe(
  Command.withDescription("Stop and remove OpenKitten from system services."),
);

const root = Command.make(pkg.name).pipe(
  Command.withDescription(
    "Telegram-first AI agent with 75+ AI providers, OS-level sandbox, and built-in capabilities people actually need.",
  ),
  Command.withSubcommands([serve, up, down]),
);

export const cli = Command.run(root, {
  version: pkg.version,
  name: "OpenKitten",
  summary: Span.text("😼 Meow!"),
});
