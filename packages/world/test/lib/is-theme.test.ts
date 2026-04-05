import { expect, test } from "vitest";

import { isTheme } from "~/lib/is-theme";

test("accepts auto and concrete color schemes", () => {
  expect(isTheme("auto")).toBe(true);
  expect(isTheme("light")).toBe(true);
  expect(isTheme("dark")).toBe(true);
});

test("rejects values outside the supported theme union", () => {
  expect(isTheme("system")).toBe(false);
  expect(isTheme("moonlight")).toBe(false);
  expect(isTheme(undefined)).toBe(false);
});
