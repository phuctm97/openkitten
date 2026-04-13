import { getTableColumns, getTableName } from "drizzle-orm";
import { expect, it } from "vitest";

import { house } from "../lib/schema";

it("defines the expected postgres table", () => {
  const columns = getTableColumns(house);

  expect(getTableName(house)).toBe("house");
  expect(Object.keys(columns)).toStrictEqual(["id", "name"]);
  expect(columns.id.primary).toBe(true);
  expect(columns.id.hasDefault).toBe(true);
  expect(columns.id.notNull).toBe(true);
  expect(columns.name.primary).toBe(false);
  expect(columns.name.notNull).toBe(true);
});
