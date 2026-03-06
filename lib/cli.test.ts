import { expect, test } from "bun:test";
import { BunContext } from "@effect/platform-bun";
import { Effect, Layer, Option } from "effect";
import { Bot } from "~/lib/bot";
import { cli } from "~/lib/cli";
import { silentConsoleLayer } from "~/lib/silent-console-layer";

const botLayer = Layer.effect(
  Bot,
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(Effect.never);
    return { fiber };
  }),
);

const wiredLayer = Layer.mergeAll(
  BunContext.layer,
  silentConsoleLayer,
  botLayer,
);

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
