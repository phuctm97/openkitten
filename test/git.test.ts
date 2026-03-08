import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { expect } from "vitest";
import { Git } from "~/lib/git";
import { Shell } from "~/lib/shell";
import { makeDockerLayer } from "~/test/make-docker-layer";

const testLayer = Git.layer.pipe(
  Layer.provideMerge(
    makeDockerLayer({
      image: "alpine/git",
      commands: [
        "git config --global user.email test@test.com",
        "git config --global user.name test",
        "mkdir /repo",
        "cd /repo && git init -b main",
        "cd /repo && git commit --allow-empty -m init",
      ],
    }),
  ),
);

it.scopedLive(
  "isMain returns true on the main branch",
  () =>
    Effect.gen(function* () {
      const git = yield* Git;
      expect(yield* git.isMain("/repo")).toBe(true);
    }).pipe(Effect.provide(testLayer)),
  { timeout: 60_000 },
);

it.scopedLive(
  "isMain returns false on a non-main branch",
  () =>
    Effect.gen(function* () {
      const shell = yield* Shell;
      yield* shell`git checkout -b feature`.cwd("/repo");
      const git = yield* Git;
      expect(yield* git.isMain("/repo")).toBe(false);
    }).pipe(Effect.provide(testLayer)),
  { timeout: 60_000 },
);

it.scopedLive(
  "isClean returns true on a clean worktree",
  () =>
    Effect.gen(function* () {
      const git = yield* Git;
      expect(yield* git.isClean("/repo")).toBe(true);
    }).pipe(Effect.provide(testLayer)),
  { timeout: 60_000 },
);

it.scopedLive(
  "isClean returns false on a dirty worktree",
  () =>
    Effect.gen(function* () {
      const shell = yield* Shell;
      yield* shell`touch /repo/dirty.txt`;
      const git = yield* Git;
      expect(yield* git.isClean("/repo")).toBe(false);
    }).pipe(Effect.provide(testLayer)),
  { timeout: 60_000 },
);
