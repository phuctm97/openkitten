import { afterEach, expect, test } from "vitest";
import { Database } from "~/lib/database";
import { getSessionAgent } from "~/lib/get-session-agent";
import * as schema from "~/lib/schema";
import { setSessionAgent } from "~/lib/set-session-agent";

let database: Database | undefined;

afterEach(() => {
  database?.[Symbol.dispose]();
  database = undefined;
});

function setup(agent?: string) {
  database = Database.create();
  database
    .insert(schema.session)
    .values({ id: "s1", chatId: 1, ...(agent !== undefined && { agent }) })
    .run();
  return database;
}

test("sets agent for an existing session", () => {
  const database = setup();
  setSessionAgent(database, "s1", "build");
  expect(getSessionAgent(database, "s1")).toBe("build");
});

test("overwrites a previously set agent", () => {
  const database = setup("assist");
  setSessionAgent(database, "s1", "plan");
  expect(getSessionAgent(database, "s1")).toBe("plan");
});

test("clears agent when set to null", () => {
  const database = setup("build");
  setSessionAgent(database, "s1", null);
  expect(getSessionAgent(database, "s1")).toBeUndefined();
});
