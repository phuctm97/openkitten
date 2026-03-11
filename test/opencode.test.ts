import { CommandExecutor } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Stream } from "effect";
import { vi } from "vitest";
import { OpenCode } from "~/lib/opencode";
import { SandboxRuntimeConfig } from "~/lib/sandbox-runtime-config";
import { textEncoder } from "~/lib/text-encoder";
import { consoleLayer } from "~/test/console-layer";
import { databaseLayer } from "~/test/database-layer";
import { loggerLayer } from "~/test/logger-layer";

// --- Mocks ---
// Hoisted so vi.mock() can reference them at module scope.
const { createOpencodeClientMock, SandboxManagerMock } = vi.hoisted(() => ({
  createOpencodeClientMock: vi.fn().mockReturnValue({ session: {} }),
  SandboxManagerMock: {
    isSupportedPlatform: vi.fn().mockReturnValue(false),
    checkDependencies: vi.fn().mockReturnValue({ errors: [] }),
    initialize: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
    wrapWithSandbox: vi.fn().mockResolvedValue("sandbox-wrapped-command"),
  },
}));

vi.mock("@opencode-ai/sdk/v2/client", () => ({
  createOpencodeClient: createOpencodeClientMock,
}));

vi.mock("@anthropic-ai/sandbox-runtime", () => ({
  SandboxManager: SandboxManagerMock,
}));

// Uses a Proxy to provide only the Process properties OpenCode actually reads,
// avoiding the need to construct a full Process object.
interface MockLayerOptions {
  stdout?: string;
  exit?: number;
  config?: Record<string, string>;
}

function mockLayer(options: MockLayerOptions = {}) {
  const { stdout, exit, config = {} } = options;
  const proc = new Proxy({} as CommandExecutor.Process, {
    get: (_, prop) => {
      if (prop === CommandExecutor.ProcessTypeId)
        return CommandExecutor.ProcessTypeId;
      if (prop === "stdout")
        return typeof stdout === "string"
          ? Stream.make(textEncoder.encode(stdout))
          : Stream.empty;
      if (prop === "exitCode")
        return typeof exit === "number" ? Effect.succeed(exit) : Effect.never;
      if (prop === "kill") return () => Effect.void;
    },
  });
  return OpenCode.layer.pipe(
    Layer.provideMerge(SandboxRuntimeConfig.layer),
    Layer.provideMerge(databaseLayer),
    Layer.provideMerge(consoleLayer),
    Layer.provideMerge(loggerLayer),
    Layer.provideMerge(
      Layer.setConfigProvider(ConfigProvider.fromJson(config)),
    ),
    Layer.provideMerge(
      Layer.succeed(
        CommandExecutor.CommandExecutor,
        CommandExecutor.makeExecutor(() => Effect.succeed(proc)),
      ),
    ),
    Layer.provideMerge(BunContext.layer),
  );
}

// --- Port parsing ---

it.scopedLive("creates client with parsed port", () => {
  const port = 1024 + Math.floor(Math.random() * 64511);
  return Effect.gen(function* () {
    yield* OpenCode;
    expect(createOpencodeClientMock).toHaveBeenCalledWith({
      baseUrl: `http://127.0.0.1:${port}`,
      headers: { authorization: expect.stringMatching(/^Basic /) },
    });
  }).pipe(
    Effect.provide(
      mockLayer({ stdout: `starting...\nlistening on :${port}\n` }),
    ),
  );
});

it.scopedLive.fails("dies when stdout closes without announcing port", () =>
  Layer.launch(mockLayer()),
);

it.scopedLive.fails("dies when stdout has listening but no port", () =>
  Layer.launch(mockLayer({ stdout: "listening without port\n" })),
);

// --- Process exit ---

it.scopedLive("completes when process exits with code 0", () =>
  Effect.gen(function* () {
    const opencode = yield* OpenCode;
    yield* opencode.fiber;
  }).pipe(
    Effect.provide(mockLayer({ stdout: "listening on :4567\n", exit: 0 })),
  ),
);

it.scopedLive.fails("dies when process exits with non-zero code", () =>
  Effect.gen(function* () {
    const opencode = yield* OpenCode;
    yield* opencode.fiber;
  }).pipe(
    Effect.provide(mockLayer({ stdout: "listening on :4567\n", exit: 1 })),
  ),
);

// --- Sandbox ---

it.scopedLive("skips sandbox when platform is unsupported", () =>
  Effect.gen(function* () {
    yield* OpenCode;
    expect(SandboxManagerMock.isSupportedPlatform).toHaveBeenCalled();
    expect(SandboxManagerMock.initialize).not.toHaveBeenCalled();
  }).pipe(Effect.provide(mockLayer({ stdout: "listening on :4567\n" }))),
);

it.scopedLive("skips sandbox when dependencies have errors", () => {
  SandboxManagerMock.isSupportedPlatform.mockReturnValueOnce(true);
  SandboxManagerMock.checkDependencies.mockReturnValueOnce({
    errors: ["missing bwrap"],
  });
  return Effect.gen(function* () {
    yield* OpenCode;
    expect(SandboxManagerMock.checkDependencies).toHaveBeenCalled();
    expect(SandboxManagerMock.initialize).not.toHaveBeenCalled();
  }).pipe(Effect.provide(mockLayer({ stdout: "listening on :4567\n" })));
});

// Uses it.live (not scopedLive) + manual Effect.scoped to assert that
// SandboxManager.reset() is called AFTER the scope closes.
it.live("initializes and resets sandbox when available", () => {
  SandboxManagerMock.isSupportedPlatform.mockReturnValueOnce(true);
  return Effect.scoped(
    Effect.gen(function* () {
      yield* OpenCode;
      expect(SandboxManagerMock.initialize).toHaveBeenCalled();
    }).pipe(Effect.provide(mockLayer({ stdout: "listening on :4567\n" }))),
  ).pipe(Effect.tap(() => expect(SandboxManagerMock.reset).toHaveBeenCalled()));
});

it.scopedLive("wraps command with sandbox when sandbox is available", () => {
  SandboxManagerMock.isSupportedPlatform.mockReturnValueOnce(true);
  return Effect.gen(function* () {
    yield* OpenCode;
    expect(SandboxManagerMock.wrapWithSandbox).toHaveBeenCalled();
  }).pipe(Effect.provide(mockLayer({ stdout: "listening on :4567\n" })));
});

for (const value of ["1", "true", "TRUE"]) {
  it.scopedLive(`skips sandbox when DANGEROUSLY_DISABLE_SANDBOX=${value}`, () =>
    Effect.gen(function* () {
      yield* OpenCode;
      expect(SandboxManagerMock.isSupportedPlatform).not.toHaveBeenCalled();
      expect(SandboxManagerMock.initialize).not.toHaveBeenCalled();
    }).pipe(
      Effect.provide(
        mockLayer({
          stdout: "listening on :4567\n",
          config: { DANGEROUSLY_DISABLE_SANDBOX: value },
        }),
      ),
    ),
  );
}
