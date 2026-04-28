import { expect, test } from "vitest";
import { createWorldQuery } from "~/lib/create-world-query";

test("exposes tanstack-query helpers for each contract procedure", () => {
  const query = createWorldQuery("http://localhost:1234");

  expect(query.me).toBeDefined();
  expect(typeof query.me.queryOptions).toBe("function");
});

test("query options expose a typed query key derived from the procedure path", () => {
  const query = createWorldQuery("http://localhost:1234");
  const options = query.me.queryOptions();

  expect(options.queryKey).toBeDefined();
  expect(Array.isArray(options.queryKey)).toBe(true);
});
