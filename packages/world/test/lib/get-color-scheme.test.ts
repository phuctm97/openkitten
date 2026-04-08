import { afterEach, expect, test, vi } from "vitest";

import { defaultColorScheme } from "~/lib/default-color-scheme";
import { getColorScheme } from "~/lib/get-color-scheme";

afterEach(() => {
  document.documentElement.style.colorScheme = "";
  vi.restoreAllMocks();
});

test("returns the inline document color scheme when it is valid", () => {
  document.documentElement.style.colorScheme = "dark";

  expect(getColorScheme()).toBe("dark");
});

test("falls back to the computed document color scheme when inline style is missing", () => {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    colorScheme: "dark",
  } as never);

  expect(getColorScheme()).toBe("dark");
});

test("defaults to the shared default color scheme when styles are invalid", () => {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    colorScheme: "sepia",
  } as never);

  expect(getColorScheme()).toBe(defaultColorScheme);
});
