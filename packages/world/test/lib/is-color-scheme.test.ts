import { expect, test } from "vitest";

import { isColorScheme } from "~/lib/is-color-scheme";

test("accepts light and dark color schemes", () => {
  expect(isColorScheme("light")).toBe(true);
  expect(isColorScheme("dark")).toBe(true);
});

test("rejects values outside the color scheme union", () => {
  expect(isColorScheme("auto")).toBe(false);
  expect(isColorScheme("sunset")).toBe(false);
  expect(isColorScheme(null)).toBe(false);
});
