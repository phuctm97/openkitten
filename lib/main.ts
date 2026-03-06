import { Command, Span } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import pkg from "~/package.json" with { type: "json" };

const serve = Command.make("serve", {}, () => Effect.void).pipe(
	Command.withDescription("Start the OpenKitten server."),
);

const up = Command.make("up", {}, () => Effect.void).pipe(
	Command.withDescription("Install and update OpenKitten as a system service."),
);

const down = Command.make("down", {}, () => Effect.void).pipe(
	Command.withDescription("Stop and remove OpenKitten from system services."),
);

const root = Command.make(pkg.name, {}).pipe(
	Command.withDescription(
		"Telegram-first AI agent with 75+ AI providers, OS-level sandbox, and built-in capabilities people actually need.",
	),
	Command.withSubcommands([serve, up, down]),
);

const cli = Command.run(root, {
	version: pkg.version,
	name: "OpenKitten",
	summary: Span.text("😼 Meow!"),
});

cli(Bun.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
