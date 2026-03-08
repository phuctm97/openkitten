import { Effect, Layer } from "effect";
import type { GenericContainer, StartedTestContainer } from "testcontainers";
import { Shell } from "~/lib/shell";

class CommandError extends Error {
  constructor(
    readonly command: string,
    readonly exitCode: number,
    readonly stdout: string,
    readonly stderr: string,
  ) {
    super(`Command failed (${exitCode})`);
  }
}

interface MakeDockerLayerOptions {
  readonly commands?: string[];
  readonly shell?: string;
}

export function makeDockerLayer(
  container: GenericContainer,
  options?: MakeDockerLayerOptions,
): Layer.Layer<Shell> {
  const sh = options?.shell || "sh";
  return Layer.scoped(
    Shell,
    Effect.gen(function* () {
      const started = yield* Effect.acquireRelease(
        Effect.promise(() =>
          container.withCommand(["sleep", "infinity"]).start(),
        ),
        (c: StartedTestContainer) => Effect.promise(() => c.stop()),
      );
      for (const command of options?.commands ?? []) {
        const result = yield* Effect.promise(() =>
          started.exec([sh, "-c", command]),
        );
        if (result.exitCode !== 0) {
          return yield* Effect.die(
            new CommandError(
              command,
              result.exitCode,
              result.stdout,
              result.stderr,
            ),
          );
        }
      }
      return (strings: TemplateStringsArray, ...values: Shell.Value[]) => {
        const makeCommand = (dir?: string): Shell.Command =>
          Object.assign(
            Effect.promise(async () => {
              const command = String.raw(strings, ...values);
              const result = await started.exec([sh, "-c", command], {
                ...(dir ? { workingDir: dir } : {}),
              });
              if (result.exitCode !== 0) {
                throw new CommandError(
                  command,
                  result.exitCode,
                  result.stdout,
                  result.stderr,
                );
              }
              return result.stdout;
            }),
            { cwd: (d: string) => makeCommand(d) },
          );
        return makeCommand();
      };
    }),
  );
}
