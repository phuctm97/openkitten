import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { cli } from "~/lib/cli";

cli(Bun.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
