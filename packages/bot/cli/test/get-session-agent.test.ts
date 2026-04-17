import { afterEach, expect, test } from "vitest";
import { Database } from "~/lib/database";
import { getSessionAgent } from "~/lib/get-session-agent";
import * as schema from "~/lib/schema";

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

test("returns undefined when no agent is set", () => {
  const database = setup();
  expect(getSessionAgent(database, "s1")).toBeUndefined();
});

test("returns undefined for nonexistent session", () => {
  const database = setup();
  expect(getSessionAgent(database, "no-such")).toBeUndefined();
});

test("returns agent set during insert", () => {
  const database = setup("assist");
  expect(getSessionAgent(database, "s1")).toBe("assist");
});

test("returns undefined for empty string agent", () => {
  const database = setup("");
  expect(getSessionAgent(database, "s1")).toBeUndefined();
});
