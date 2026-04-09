import { expect, test } from "vitest";

import { getHousePalette } from "~/lib/get-house-palette";

test("returns the light palette for the light color scheme", () => {
  expect(getHousePalette("light")).toEqual({
    backgroundColor: "#ffffff",
  });
});

test("returns the dark palette for the dark color scheme", () => {
  expect(getHousePalette("dark")).toEqual({
    backgroundColor: "#0c0a09",
  });
});
