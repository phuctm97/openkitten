import { CommandExecutor } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { expect, it } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import { vi } from "vitest";
import { OpenCode } from "~/lib/opencode";
import { SandboxRuntimeConfig } from "~/lib/sandbox-runtime-config";
import { textEncoder } from "~/lib/text-encoder";
import { consoleLayer } from "~/test/console-layer";
import { databaseLayer } from "~/test/database-layer";
import { loggerLayer } from "~/test/logger-layer";

const { createOpencodeClientMock } = vi.hoisted(() => ({
  createOpencodeClientMock: vi.fn().mockReturnValue({ session: {} }),
}));

vi.mock("@opencode-ai/sdk/v2/client", () => ({
  createOpencodeClient: createOpencodeClientMock,
}));

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
    Layer.provideMerge(SandboxRuntimeConfig.layer),
    Layer.provideMerge(databaseLayer),
    Layer.provideMerge(consoleLayer),
    Layer.provideMerge(loggerLayer),
    Layer.provideMerge(
      Layer.succeed(
        CommandExecutor.CommandExecutor,
        CommandExecutor.makeExecutor(() => Effect.succeed(proc)),
      ),
    ),
    Layer.provideMerge(BunContext.layer),
  );
}

it.scopedLive("creates client with parsed port", () => {
  const port = 1024 + Math.floor(Math.random() * 64511);
  return Effect.gen(function* () {
    yield* OpenCode;
    expect(createOpencodeClientMock).toHaveBeenCalledWith({
      baseUrl: `http://127.0.0.1:${port}`,
    });
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
    const opencode = yield* OpenCode;
    yield* opencode.fiber;
  }).pipe(Effect.provide(mockLayer("listening on :4567\n", 0))),
);

it.scopedLive.fails("dies when process exits with non-zero code", () =>
  Effect.gen(function* () {
    const opencode = yield* OpenCode;
    yield* opencode.fiber;
  }).pipe(Effect.provide(mockLayer("listening on :4567\n", 1))),
);
