import { resolve } from "node:path";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import { Command } from "@effect/platform";
import {
  createOpencodeClient,
  type OpencodeClient,
} from "@opencode-ai/sdk/v2/client";
import { Context, Deferred, Effect, type Fiber, Layer, Stream } from "effect";
import { quote } from "shell-quote";
import { SandboxRuntimeConfig } from "~/lib/sandbox-runtime-config";
import pkg from "~/package.json" with { type: "json" };

export class OpenCode extends Context.Tag(`${pkg.name}/OpenCode`)<
  OpenCode,
  { readonly fiber: Fiber.RuntimeFiber<void>; readonly client: OpencodeClient }
>() {
  static readonly layer = Layer.scoped(
    OpenCode,
    Effect.gen(function* () {
      yield* Effect.logDebug("OpenCode.service is starting");
      yield* Effect.addFinalizer(() =>
        Effect.logInfo("OpenCode.service has stopped"),
      );
      const cmd = yield* OpenCode.command();
      const proc = yield* Command.start(cmd);
      const portDeferred = yield* Deferred.make<number>();
      yield* proc.stdout.pipe(
        Stream.decodeText(),
        Stream.splitLines,
        Stream.tap((line) => {
          if (!line.includes("listening")) return Effect.void;
          const match = line.match(/:(\d+)/);
          return match
            ? Deferred.succeed(portDeferred, Number(match[1]))
            : Deferred.die(
                portDeferred,
                new Error(`Cannot parse port from: ${line}`),
              );
        }),
        Stream.runDrain,
        Effect.ensuring(
          Deferred.die(
            portDeferred,
            new Error("opencode exited without announcing port"),
          ),
        ),
        Effect.forkScoped,
      );
      const portAwaited = yield* Deferred.await(portDeferred);
      yield* Effect.logDebug("OpenCode.service parsed port").pipe(
        Effect.annotateLogs("port", portAwaited),
      );
      const fiber = yield* proc.exitCode.pipe(
        Effect.orDie,
        Effect.flatMap((code) =>
          code === 0
            ? Effect.void
            : Effect.die(new Error(`opencode exited with code ${code}`)),
        ),
        Effect.forkScoped,
      );
      const client = createOpencodeClient({
        baseUrl: `http://127.0.0.1:${portAwaited}`,
      });
      yield* Effect.logInfo("OpenCode.service is ready");
      yield* Effect.addFinalizer(() =>
        Effect.logDebug("OpenCode.service is stopping"),
      );
      return OpenCode.of({ fiber, client });
    }),
  );
  static readonly argv = [
    resolve(import.meta.dirname, "../node_modules/.bin/opencode"),
    "serve",
    "--hostname",
    "127.0.0.1",
    "--port",
    "0",
  ] as const;
  static sandbox() {
    return Effect.gen(function* () {
      const config = yield* SandboxRuntimeConfig;
      if (!SandboxManager.isSupportedPlatform()) {
        yield* Effect.logWarning(
          "OpenCode.sandbox is unavailable: platform not supported",
        );
        return false;
      }
      const deps = SandboxManager.checkDependencies();
      if (deps.errors.length > 0) {
        yield* Effect.logWarning(
          `OpenCode.sandbox is unavailable: ${deps.errors.join(", ")}`,
        );
        return false;
      }
      yield* Effect.acquireRelease(
        Effect.logDebug("OpenCode.sandbox is initializing").pipe(
          Effect.andThen(
            Effect.promise(() => SandboxManager.initialize(config)),
          ),
          Effect.tap(Effect.logDebug("OpenCode.sandbox is initialized")),
        ),
        () =>
          Effect.logDebug("OpenCode.sandbox is disposing").pipe(
            Effect.andThen(Effect.promise(() => SandboxManager.reset())),
            Effect.tap(Effect.logDebug("OpenCode.sandbox is disposed")),
            Effect.annotateLogs("debugHint", "OpenCode.sandbox"),
            Effect.ignoreLogged,
          ),
      );
      return true;
    });
  }
  static command() {
    return Effect.gen(function* () {
      const sandboxed = yield* OpenCode.sandbox();
      if (!sandboxed) {
        yield* Effect.logWarning("OpenCode.service is unsandboxed");
        return Command.make(...OpenCode.argv).pipe(Command.stderr("inherit"));
      }
      yield* Effect.logInfo("OpenCode.service is sandboxed");
      const raw = quote(OpenCode.argv);
      const wrapped = yield* Effect.promise(() =>
        SandboxManager.wrapWithSandbox(raw),
      );
      return Command.make("bash", "-c", wrapped).pipe(
        Command.stderr("inherit"),
      );
    });
  }
}
