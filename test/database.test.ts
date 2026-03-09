import { expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { Database } from "~/lib/database";
import { defaultLayer } from "~/test/default-layer";

it.scopedLive("insert and find session", () =>
  Effect.gen(function* () {
    const database = yield* Database;
    const inserted = yield* database.session.insert({
      sessionKey: "c:123/t:42",
      sessionId: "session-1",
      createdAt: undefined,
      updatedAt: undefined,
    });
    expect(inserted.sessionKey).toBe("c:123/t:42");
    expect(inserted.sessionId).toBe("session-1");
    expect(inserted.createdAt).toBeDefined();
    expect(inserted.updatedAt).toBeDefined();
    const found = yield* database.session.findById("c:123/t:42");
    expect(Option.isSome(found)).toBe(true);
    expect(Option.getOrThrow(found).sessionId).toBe("session-1");
    const notFound = yield* database.session.findById("c:999");
    expect(Option.isNone(notFound)).toBe(true);
  }).pipe(Effect.provide(defaultLayer)),
);

it.scopedLive("findBySessionId returns matching session", () =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.session.insert({
      sessionKey: "c:456/t:10",
      sessionId: "target-session",
      createdAt: undefined,
      updatedAt: undefined,
    });
    const found = yield* database.session.findBySessionId("target-session");
    expect(Option.isSome(found)).toBe(true);
    const value = Option.getOrThrow(found);
    expect(value.sessionKey).toBe("c:456/t:10");
    expect(value.sessionId).toBe("target-session");
  }).pipe(Effect.provide(defaultLayer)),
);

it.scopedLive("findBySessionId returns none for unknown", () =>
  Effect.gen(function* () {
    const database = yield* Database;
    const notFound = yield* database.session.findBySessionId(
      "nonexistent-session",
    );
    expect(Option.isNone(notFound)).toBe(true);
  }).pipe(Effect.provide(defaultLayer)),
);
