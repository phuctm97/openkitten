import { resolve } from "node:path";
import { Command } from "@effect/platform";
import {
  createOpencodeClient,
  type OpencodeClient,
} from "@opencode-ai/sdk/v2/client";
import { Context, Deferred, Effect, type Fiber, Layer, Stream } from "effect";
import pkg from "~/package.json" with { type: "json" };

export class OpenCode extends Context.Tag(`${pkg.name}/OpenCode`)<
  OpenCode,
  { readonly fiber: Fiber.RuntimeFiber<void>; readonly client: OpencodeClient }
>() {
  static readonly layer = Layer.scoped(
    OpenCode,
    Effect.gen(function* () {
      yield* Effect.logInfo("OpenCode.service is starting");
      yield* Effect.addFinalizer(() =>
        Effect.logInfo("OpenCode.service has stopped"),
      );
      const cmd = Command.make(
        resolve(import.meta.dirname, "../node_modules/.bin/opencode"),
        "serve",
        "--hostname",
        "127.0.0.1",
        "--port",
        "0",
      ).pipe(Command.stderr("inherit"));
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
      const port = yield* Deferred.await(portDeferred);
      const fiber = yield* proc.exitCode.pipe(
        Effect.orDie,
        Effect.flatMap((code) =>
          code === 0
            ? Effect.void
            : Effect.die(new Error(`opencode exited with code ${code}`)),
        ),
        Effect.forkScoped,
      );
      yield* Effect.addFinalizer(() =>
        Effect.logInfo("OpenCode.service is stopping"),
      );
      const client = createOpencodeClient({
        baseUrl: `http://127.0.0.1:${port}`,
      });
      yield* Effect.logInfo("OpenCode.service is ready");
      return OpenCode.of({ fiber, client });
    }),
  );
}
