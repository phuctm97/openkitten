import { getTableConfig } from "drizzle-orm/sqlite-core";
import { expect, test } from "vitest";
import * as schema from "~/lib/schema";

test("message references session", () => {
  const config = getTableConfig(schema.message);
  const fk = config.foreignKeys[0];
  expect(fk?.reference().foreignTable).toBe(schema.session);
});

test("schedule references session", () => {
  const config = getTableConfig(schema.schedule);
  const fk = config.foreignKeys[0];
  expect(fk?.reference().foreignTable).toBe(schema.session);
});

test("sessionRelations includes schedules", () => {
  expect(schema.sessionRelations.table).toBe(schema.session);
});

test("scheduleRelations maps to session", () => {
  expect(schema.scheduleRelations.table).toBe(schema.schedule);
});

test("scheduleRun references schedule", () => {
  const config = getTableConfig(schema.scheduleRun);
  const fk = config.foreignKeys[0];
  expect(fk?.reference().foreignTable).toBe(schema.schedule);
});

test("scheduleRunRelations maps to schedule", () => {
  expect(schema.scheduleRunRelations.table).toBe(schema.scheduleRun);
});
