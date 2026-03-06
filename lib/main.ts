import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { Bot } from "~/lib/bot";
import { cli } from "~/lib/cli";

const wiredLayer = Layer.provideMerge(Bot.layer, BunContext.layer);

cli(Bun.argv).pipe(Effect.provide(wiredLayer), BunRuntime.runMain);
