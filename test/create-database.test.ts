import { consola } from "consola";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { createDatabase } from "~/lib/create-database";
import * as schema from "~/lib/schema";

function db() {
  return createDatabase(":memory:");
}

test("logs ready", () => {
  using _database = db();
  expect(consola.ready).toHaveBeenCalledWith("Database is ready");
});

test("is disposable", () => {
  {
    using _db = db();
  }
  expect(consola.debug).toHaveBeenCalledWith("Database is closed");
});

test("inserts session with default timestamps", () => {
  using database = db();
  const result = database
    .insert(schema.session)
    .values({ id: "s1", chatId: 123 })
    .returning()
    .get();
  expect(result.createdAt).toBeInstanceOf(Date);
  expect(result.updatedAt).toBeInstanceOf(Date);
});

test("updates updatedAt on session update", () => {
  using database = db();
  const inserted = database
    .insert(schema.session)
    .values({ id: "s1", chatId: 123 })
    .returning()
    .get();
  const updated = database
    .update(schema.session)
    .set({ chatId: 456 })
    .where(eq(schema.session.id, "s1"))
    .returning()
    .get();
  expect(updated?.updatedAt >= inserted.updatedAt).toBe(true);
});

test("cascades message delete on session delete", () => {
  using database = db();
  database.insert(schema.session).values({ id: "s1", chatId: 123 }).run();
  database.insert(schema.message).values({ id: "m1", sessionId: "s1" }).run();
  database.delete(schema.session).where(eq(schema.session.id, "s1")).run();
  expect(database.select().from(schema.message).all()).toHaveLength(0);
});
