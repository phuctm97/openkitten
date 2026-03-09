import { expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { Database } from "~/lib/database";
import { defaultLayer } from "~/test/default-layer";

it.scopedLive("insert and find session", () =>
  Effect.gen(function* () {
    const database = yield* Database;
    const inserted = yield* database.session.insert({
      id: "session-1",
      chatId: 123,
      threadId: 42,
      dmTopicId: 0,
      createdAt: undefined,
      updatedAt: undefined,
    });
    expect(inserted.id).toBe("session-1");
    expect(inserted.chatId).toBe(123);
    expect(inserted.threadId).toBe(42);
    expect(inserted.dmTopicId).toBe(0);
    expect(inserted.createdAt).toBeDefined();
    expect(inserted.updatedAt).toBeDefined();
    const found = yield* database.session.findById("session-1");
    expect(Option.isSome(found)).toBe(true);
    expect(Option.getOrThrow(found).chatId).toBe(123);
    const notFound = yield* database.session.findById("nonexistent");
    expect(Option.isNone(notFound)).toBe(true);
  }).pipe(Effect.provide(defaultLayer)),
);

it.scopedLive("findByChat returns matching session", () =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.session.insert({
      id: "target-session",
      chatId: 456,
      threadId: 10,
      dmTopicId: 0,
      createdAt: undefined,
      updatedAt: undefined,
    });
    const found = yield* database.session.findByChat({
      chatId: 456,
      threadId: 10,
      dmTopicId: 0,
    });
    expect(Option.isSome(found)).toBe(true);
    const value = Option.getOrThrow(found);
    expect(value.id).toBe("target-session");
    expect(value.chatId).toBe(456);
    expect(value.threadId).toBe(10);
  }).pipe(Effect.provide(defaultLayer)),
);

it.scopedLive("findByChat returns none for unknown", () =>
  Effect.gen(function* () {
    const database = yield* Database;
    const notFound = yield* database.session.findByChat({
      chatId: 999,
      threadId: 0,
      dmTopicId: 0,
    });
    expect(Option.isNone(notFound)).toBe(true);
  }).pipe(Effect.provide(defaultLayer)),
);

it.scopedLive(
  "message.claim returns true on first insert, false on duplicate",
  () =>
    Effect.gen(function* () {
      const database = yield* Database;
      yield* database.session.insert({
        id: "session-1",
        chatId: 123,
        threadId: 0,
        dmTopicId: 0,
        createdAt: undefined,
        updatedAt: undefined,
      });
      const first = yield* database.message.claim({
        id: "msg-1",
        sessionId: "session-1",
        createdAt: 1000,
      });
      expect(first).toBe(true);
      const second = yield* database.message.claim({
        id: "msg-1",
        sessionId: "session-1",
        createdAt: 1000,
      });
      expect(second).toBe(false);
    }).pipe(Effect.provide(defaultLayer)),
);
