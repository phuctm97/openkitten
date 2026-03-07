import { CommandExecutor } from "@effect/platform";
import { expect, it } from "@effect/vitest";
import { Effect, Layer, Logger, Stream } from "effect";
import { OpenCode } from "~/lib/opencode";
import { textEncoder } from "~/lib/text-encoder";

function mockLayer(stdout?: string, exitCode?: number) {
  const proc = new Proxy({} as CommandExecutor.Process, {
    get: (_, prop) => {
      if (prop === CommandExecutor.ProcessTypeId)
        return CommandExecutor.ProcessTypeId;
      if (prop === "stdout")
        return typeof stdout === "string"
          ? Stream.make(textEncoder.encode(stdout))
          : Stream.empty;
      if (prop === "exitCode")
        return typeof exitCode === "number"
          ? Effect.succeed(exitCode)
          : Effect.never;
      if (prop === "kill") return () => Effect.void;
    },
  });
  return OpenCode.layer.pipe(
    Layer.provideMerge(
      Layer.succeed(
        CommandExecutor.CommandExecutor,
        CommandExecutor.makeExecutor(() => Effect.succeed(proc)),
      ),
    ),
    Layer.provideMerge(Logger.replace(Logger.defaultLogger, Logger.none)),
  );
}

it.scopedLive("exposes parsed port", () => {
  const port = 1024 + Math.floor(Math.random() * 64511);
  return Effect.gen(function* () {
    const openCode = yield* OpenCode;
    expect(openCode.port).toBe(port);
  }).pipe(Effect.provide(mockLayer(`starting...\nlistening on :${port}\n`)));
});

it.scopedLive.fails("dies when stdout closes without announcing port", () =>
  Layer.launch(mockLayer()),
);

it.scopedLive.fails("dies when stdout has listening but no port", () =>
  Layer.launch(mockLayer("listening without port\n")),
);

it.scopedLive("completes when process exits with code 0", () =>
  Effect.gen(function* () {
    const openCode = yield* OpenCode;
    yield* openCode.fiber;
  }).pipe(Effect.provide(mockLayer("listening on :4567\n", 0))),
);

it.scopedLive.fails("dies when process exits with non-zero code", () =>
  Effect.gen(function* () {
    const openCode = yield* OpenCode;
    yield* openCode.fiber;
  }).pipe(Effect.provide(mockLayer("listening on :4567\n", 1))),
);
