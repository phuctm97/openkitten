import { Effect, Layer } from "effect";
import { Shell } from "~/lib/shell";

interface MakeDockerLayerOptions {
  readonly image: string;
  readonly commands?: string[];
}

export function makeDockerLayer(
  options: MakeDockerLayerOptions,
): Layer.Layer<Shell> {
  return Layer.scoped(
    Shell,
    Effect.gen(function* () {
      const containerId = yield* Effect.acquireRelease(
        Effect.promise(async () => {
          const id = (
            await Bun.$`docker run -d --entrypoint sh ${options.image} -c "sleep infinity"`.text()
          ).trim();
          try {
            for (const command of options.commands ?? []) {
              await Bun.$`docker exec ${id} sh -c ${command}`.quiet();
            }
          } catch (error) {
            await Bun.$`docker rm -f ${id}`.quiet().nothrow();
            throw error;
          }
          return id;
        }),
        (id) =>
          Effect.promise(() => Bun.$`docker rm -f ${id}`.quiet().nothrow()),
      );
      return (strings: TemplateStringsArray, ...values: Shell.Value[]) => {
        const makeCommand = (dir?: string): Shell.Command =>
          Object.assign(
            Effect.promise(async () => {
              const command = String.raw(strings, ...values);
              const containerArgs = dir ? ["-w", dir] : [];
              return Bun.$`docker exec ${containerArgs} ${containerId} sh -c ${command}`.text();
            }),
            { cwd: (d: string) => makeCommand(d) },
          );
        return makeCommand();
      };
    }),
  );
}
