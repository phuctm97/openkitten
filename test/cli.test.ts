import { BunContext } from "@effect/platform-bun";
import { expect, it } from "@effect/vitest";
import { Console, Effect, Layer, Logger, Option } from "effect";
import { vi } from "vitest";
import { Bot } from "~/lib/bot";
import { cli } from "~/lib/cli";
import { OpenCode } from "~/lib/opencode";
import { Scripts } from "~/lib/scripts";

const consoleLayer = Console.setConsole(
  new Proxy({} as Console.Console, {
    get: (_target, prop) =>
      prop === Console.TypeId ? Console.TypeId : () => Effect.void,
  }),
);

const botLayer = Layer.effect(
  Bot,
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(Effect.never);
    return { fiber };
  }),
);

const openCodeLayer = Layer.effect(
  OpenCode,
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(Effect.never);
    return { fiber, port: 4096 };
  }),
);

const scriptsMock = Scripts.of({
  up: vi.fn().mockResolvedValue(undefined),
  down: vi.fn().mockResolvedValue(undefined),
});

const scriptsLayer = Layer.succeed(Scripts, scriptsMock);

const testLayer = Layer.mergeAll(
  BunContext.layer,
  consoleLayer,
  botLayer,
  openCodeLayer,
  scriptsLayer,
  Logger.replace(Logger.defaultLogger, Logger.none),
);

it.live.fails("unknown command fails", () =>
  cli(["bun", ".", "unknown"]).pipe(Effect.provide(testLayer)),
);

it.live("up command succeeds", () =>
  cli(["bun", ".", "up"]).pipe(
    Effect.provide(testLayer),
    Effect.map(() => expect(scriptsMock.up).toHaveBeenCalledOnce()),
  ),
);

it.live("down command succeeds", () =>
  cli(["bun", ".", "down"]).pipe(
    Effect.provide(testLayer),
    Effect.map(() => expect(scriptsMock.down).toHaveBeenCalledOnce()),
  ),
);

it.live("serve command starts and can be interrupted", () =>
  cli(["bun", ".", "serve"]).pipe(
    Effect.provide(testLayer),
    Effect.timeout(0),
    Effect.option,
    Effect.map((opt) => expect(opt).toEqual(Option.none())),
  ),
);
