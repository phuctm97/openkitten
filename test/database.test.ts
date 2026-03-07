import { BunContext } from "@effect/platform-bun";
import { expect, it } from "@effect/vitest";
import { Effect, Layer, Logger, Option } from "effect";
import { Database } from "~/lib/database";
import { makeDatabaseLayer } from "~/lib/make-database-layer";

const testLayer = makeDatabaseLayer().pipe(
  Layer.provide(BunContext.layer),
  Layer.provide(Logger.replace(Logger.defaultLogger, Logger.none)),
);

it.scopedLive("insert and find profile", () =>
  Effect.gen(function* () {
    const database = yield* Database;
    const insertedProfile = yield* database.profile.insert({
      id: "default",
      activeSessionId: Option.none<string>(),
      createdAt: undefined,
      updatedAt: undefined,
    });
    expect(insertedProfile.id).toBe("default");
    expect(Option.isNone(insertedProfile.activeSessionId)).toBe(true);
    expect(insertedProfile.createdAt).toBeDefined();
    expect(insertedProfile.updatedAt).toBeDefined();
    const foundProfile = yield* database.profile.findById("default");
    expect(Option.isSome(foundProfile)).toBe(true);
    expect(Option.getOrThrow(foundProfile).id).toBe("default");
  }).pipe(Effect.provide(testLayer)),
);
