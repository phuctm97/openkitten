import { Command, Span } from "@effect/cli";
import { Effect, Fiber, type Layer } from "effect";
import { Bot } from "~/lib/bot";
import { OpenCode } from "~/lib/opencode";
import { Scripts } from "~/lib/scripts";
import pkg from "~/package.json" with { type: "json" };

const serve = Command.make("serve", {}, () =>
  Effect.gen(function* () {
    const bot = yield* Bot;
    const opencode = yield* OpenCode;
    return yield* Fiber.join(Fiber.zip(bot.fiber, opencode.fiber));
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

export interface CliOptions<R1, R2> {
  readonly argv: string[];
  readonly serverLayer: Layer.Layer<Bot | OpenCode, unknown, R1>;
  readonly scriptsLayer: Layer.Layer<Scripts, unknown, R2>;
}

export function cli<R1, R2>(options: CliOptions<R1, R2>) {
  const cmd = Command.make(pkg.name).pipe(
    Command.withDescription(
      "Telegram-first AI agent with 75+ AI providers, OS-level sandbox, and built-in capabilities people actually need.",
    ),
    Command.withSubcommands([
      serve.pipe(Command.provide(options.serverLayer)),
      up.pipe(Command.provide(options.scriptsLayer)),
      down.pipe(Command.provide(options.scriptsLayer)),
    ]),
  );
  return Command.run(cmd, {
    version: pkg.version,
    name: "OpenKitten",
    summary: Span.text("😼 Meow!"),
  })(options.argv);
}
