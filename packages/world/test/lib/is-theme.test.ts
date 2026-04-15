import { expect, test } from "vitest";

import { isTheme } from "~/lib/is-theme";

test("accepts system and concrete color schemes", () => {
  expect(isTheme("system")).toBe(true);
  expect(isTheme("light")).toBe(true);
  expect(isTheme("dark")).toBe(true);
});

test("rejects values outside the supported theme union", () => {
  expect(isTheme("auto")).toBe(false);
  expect(isTheme("moonlight")).toBe(false);
  expect(isTheme(undefined)).toBe(false);
});
