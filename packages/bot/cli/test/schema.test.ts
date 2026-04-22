import { getTableConfig } from "drizzle-orm/sqlite-core";
import { expect, test } from "vitest";
import * as schema from "~/lib/schema";

test("message references session", () => {
  const config = getTableConfig(schema.message);
  const fk = config.foreignKeys[0];
  expect(fk?.reference().foreignTable).toBe(schema.session);
});

test("schedule has no session foreign key", () => {
  const config = getTableConfig(schema.schedule);
  expect(config.foreignKeys).toHaveLength(0);
});

test("schedule indexes chatId and threadId", () => {
  const config = getTableConfig(schema.schedule);
  const idx = config.indexes.find(
    (i) => i.config.name === "schedule_chat_id_thread_id_idx",
  );
  expect(idx).toBeDefined();
});

test("sessionRelations includes scheduleRuns", () => {
  expect(schema.sessionRelations.table).toBe(schema.session);
});

test("scheduleRelations maps to runs", () => {
  expect(schema.scheduleRelations.table).toBe(schema.schedule);
});

test("scheduleRun references schedule and session", () => {
  const config = getTableConfig(schema.scheduleRun);
  const tables = config.foreignKeys.map((fk) => fk.reference().foreignTable);
  expect(tables).toContain(schema.schedule);
  expect(tables).toContain(schema.session);
});

test("scheduleRun.session_id is set null on parent delete", () => {
  const config = getTableConfig(schema.scheduleRun);
  const sessionFk = config.foreignKeys.find(
    (fk) => fk.reference().foreignTable === schema.session,
  );
  expect(sessionFk?.onDelete).toBe("set null");
});

test("scheduleRunRelations maps to schedule", () => {
  expect(schema.scheduleRunRelations.table).toBe(schema.scheduleRun);
});
