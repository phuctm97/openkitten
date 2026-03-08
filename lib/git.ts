import { Context, Effect, Layer } from "effect";
import { Shell } from "~/lib/shell";
import pkg from "~/package.json" with { type: "json" };

export class Git extends Context.Tag(`${pkg.name}/Git`)<
  Git,
  {
    readonly isMain: (dir: string) => Effect.Effect<boolean>;
    readonly isClean: (dir: string) => Effect.Effect<boolean>;
  }
>() {
  static readonly layer = Layer.effect(
    Git,
    Effect.gen(function* () {
      const shell = yield* Shell;
      return Git.of({
        isMain: (dir) =>
          Effect.map(
            shell`git rev-parse --abbrev-ref HEAD`.cwd(dir),
            (branch) => branch.trim() === "main",
          ),
        isClean: (dir) =>
          Effect.map(
            shell`git status --porcelain`.cwd(dir),
            (status) => status.trim() === "",
          ),
      });
    }),
  );
}
