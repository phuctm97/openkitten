import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { Bot } from "~/lib/bot";
import { cli } from "~/lib/cli";
import { Scripts } from "~/lib/scripts";

const scriptsLayer = Layer.succeed(Scripts, {
  up: async () => {},
  down: async () => {},
});

const runLayer = Layer.mergeAll(BunContext.layer, scriptsLayer).pipe(
  Layer.provideMerge(Bot.layer),
);

cli(Bun.argv).pipe(Effect.provide(runLayer), BunRuntime.runMain);
