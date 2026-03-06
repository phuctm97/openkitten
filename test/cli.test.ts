import { BunContext } from "@effect/platform-bun";
import { Console, Effect, Layer, Option } from "effect";
import { expect, test } from "vitest";
import { Bot } from "~/lib/bot";
import { cli } from "~/lib/cli";

const consoleLayer = Console.setConsole(
  new Proxy({} as Console.Console, {
    get: (_, prop) => (prop === Console.TypeId ? Console.TypeId : Effect.void),
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

const run = (...args: ReadonlyArray<string>) =>
  cli(["bun", ".", ...args]).pipe(
    Effect.provide(wiredLayer),
    Effect.runPromise,
  );

test("unknown command fails", () => expect(run("unknown")).rejects.toThrow());

for (const cmd of ["up", "down"])
  test(`${cmd} command succeeds`, () =>
    expect(run(cmd)).resolves.toBeUndefined());

test("serve command starts and can be interrupted", () =>
  expect(
    cli(["bun", ".", "serve"]).pipe(
      Effect.provide(wiredLayer),
      Effect.timeout(0),
      Effect.option,
      Effect.runPromise,
    ),
  ).resolves.toStrictEqual(Option.none()));
