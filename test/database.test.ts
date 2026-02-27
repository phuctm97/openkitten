import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { Database } from "~/lib/database";
import { logger } from "~/lib/logger";
import * as schema from "~/lib/schema";

function db() {
  return Database.create();
}

test("logs start and ready", () => {
  using _database = db();
  expect(logger.debug).toHaveBeenCalledWith("Database is initializing…");
  expect(logger.info).toHaveBeenCalledWith("Database is ready");
});

test("is disposable", () => {
  {
    using _db = db();
  }
  expect(logger.info).toHaveBeenCalledWith("Database is closed");
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

test("closes connection and logs fatal on migration failure", () => {
  const original = Database.migrationsFolder;
  Object.defineProperty(Database, "migrationsFolder", {
    value: "/nonexistent/migrations",
    writable: true,
  });
  try {
    expect(() => Database.create()).toThrow();
  } finally {
    Object.defineProperty(Database, "migrationsFolder", {
      value: original,
      writable: false,
    });
  }
});

test("cascades message delete on session delete", () => {
  using database = db();
  database.insert(schema.session).values({ id: "s1", chatId: 123 }).run();
  database.insert(schema.message).values({ id: "m1", sessionId: "s1" }).run();
  database.delete(schema.session).where(eq(schema.session.id, "s1")).run();
  expect(database.select().from(schema.message).all()).toHaveLength(0);
});
