import { BunContext } from "@effect/platform-bun";
import { expect, it } from "@effect/vitest";
import { Effect, Layer, Logger, Option } from "effect";
import { Database } from "~/lib/database";
import { makeDatabaseLayer } from "~/lib/make-database-layer";

const testLayer = makeDatabaseLayer().pipe(
  Layer.provide(BunContext.layer),
  Layer.provide(Logger.replace(Logger.defaultLogger, Logger.none)),
);

const defaultProfile = {
  id: "default",
  activeSessionId: Option.none<string>(),
  createdAt: undefined,
  updatedAt: undefined,
} as const;

it.scopedLive("migration runs", () => Effect.provide(Database, testLayer));

it.scopedLive("insert profile", () =>
  Effect.gen(function* () {
    const database = yield* Database;
    const insertedProfile = yield* database.profile.insert(defaultProfile);
    expect(insertedProfile.id).toBe("default");
    expect(Option.isNone(insertedProfile.activeSessionId)).toBe(true);
    expect(insertedProfile.createdAt).toBeDefined();
    expect(insertedProfile.updatedAt).toBeDefined();
  }).pipe(Effect.provide(testLayer)),
);

it.scopedLive("find by id", () =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.profile.insert(defaultProfile);
    const foundProfile = yield* database.profile.findById("default");
    expect(Option.isSome(foundProfile)).toBe(true);
    expect(Option.getOrThrow(foundProfile).id).toBe("default");
  }).pipe(Effect.provide(testLayer)),
);

it.scopedLive("find non-existent returns none", () =>
  Effect.gen(function* () {
    const database = yield* Database;
    const foundProfile = yield* database.profile.findById("missing");
    expect(Option.isNone(foundProfile)).toBe(true);
  }).pipe(Effect.provide(testLayer)),
);

it.scopedLive("update profile", () =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.profile.insert(defaultProfile);
    const updatedProfile = yield* database.profile.update({
      id: "default",
      activeSessionId: Option.some("session-123"),
      updatedAt: undefined,
    });
    expect(Option.getOrThrow(updatedProfile.activeSessionId)).toBe(
      "session-123",
    );
  }).pipe(Effect.provide(testLayer)),
);

it.scopedLive("delete profile", () =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.profile.insert(defaultProfile);
    yield* database.profile.delete("default");
    const foundProfile = yield* database.profile.findById("default");
    expect(Option.isNone(foundProfile)).toBe(true);
  }).pipe(Effect.provide(testLayer)),
);
