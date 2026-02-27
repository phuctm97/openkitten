import { getTableConfig } from "drizzle-orm/sqlite-core";
import { expect, test } from "vitest";
import * as schema from "~/lib/schema";

test("message references session", () => {
  const config = getTableConfig(schema.message);
  const fk = config.foreignKeys[0];
  expect(fk?.reference().foreignTable).toBe(schema.session);
});
