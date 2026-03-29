import { afterEach, expect, test } from "vitest";
import { Database } from "~/lib/database";
import { ExistingAgents } from "~/lib/existing-agents";
import * as schema from "~/lib/schema";

let database: Database;

afterEach(() => {
  database[Symbol.dispose]();
});

function setup(agent?: string) {
  database = Database.create();
  database
    .insert(schema.session)
    .values({ id: "s1", chatId: 1, ...(agent !== undefined && { agent }) })
    .run();
  return ExistingAgents.create(database);
}

test("returns undefined when no agent is set", () => {
  const existingAgents = setup();
  expect(existingAgents.get("s1")).toBeUndefined();
});

test("returns undefined for nonexistent session", () => {
  const existingAgents = setup();
  expect(existingAgents.get("no-such")).toBeUndefined();
});

test("returns agent after set", () => {
  const existingAgents = setup();
  existingAgents.set("s1", "build");
  expect(existingAgents.get("s1")).toBe("build");
});

test("overwrites previously set agent", () => {
  const existingAgents = setup("assist");
  existingAgents.set("s1", "plan");
  expect(existingAgents.get("s1")).toBe("plan");
});

test("returns agent set during insert", () => {
  const existingAgents = setup("assist");
  expect(existingAgents.get("s1")).toBe("assist");
});

test("returns undefined for empty string agent", () => {
  const existingAgents = setup("");
  expect(existingAgents.get("s1")).toBeUndefined();
});

test("clears agent when set to null", () => {
  const existingAgents = setup("build");
  existingAgents.set("s1", null);
  expect(existingAgents.get("s1")).toBeUndefined();
});
