import { expect, test } from "vitest";
import { createWorldClient, createWorldQuery } from "~/lib/main";

test("re-exports createWorldClient", () => {
  expect(typeof createWorldClient).toBe("function");
});

test("re-exports createWorldQuery", () => {
  expect(typeof createWorldQuery).toBe("function");
});
