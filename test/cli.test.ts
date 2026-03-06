import { BunContext } from "@effect/platform-bun";
import { expect, it } from "@effect/vitest";
import { Console, Effect, Layer, Option } from "effect";
import { Bot } from "~/lib/bot";
import { cli } from "~/lib/cli";

const consoleLayer = Console.setConsole(
  new Proxy({} as Console.Console, {
    get: (_target, prop) =>
      prop === Console.TypeId ? Console.TypeId : Effect.void,
  }),
);

const botLayer = Layer.effect(
  Bot,
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(Effect.never);
    return { fiber };
  }),
);

const wiredLayer = Layer.mergeAll(BunContext.layer, consoleLayer, botLayer);

it.live.fails("unknown command fails", () =>
  cli(["bun", ".", "unknown"]).pipe(Effect.provide(wiredLayer)),
);

for (const command of ["up", "down"])
  it.live(`${command} command succeeds`, () =>
    cli(["bun", ".", command]).pipe(Effect.provide(wiredLayer)),
  );

it.live("serve command starts and can be interrupted", () =>
  cli(["bun", ".", "serve"]).pipe(
    Effect.provide(wiredLayer),
    Effect.timeout(0),
    Effect.option,
    Effect.map((opt) => expect(opt).toEqual(Option.none())),
  ),
);
