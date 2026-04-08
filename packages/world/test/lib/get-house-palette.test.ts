import { expect, test } from "vitest";

import { getHousePalette } from "~/lib/get-house-palette";

test("returns the light palette for the light color scheme", () => {
  expect(getHousePalette("light")).toEqual({
    backgroundColor: "#ffffff",
    cardBorderAlpha: 1,
    cardBorderColor: 0xe7e5e4,
    cardColor: 0xffffff,
    glowAlpha: 0.16,
    glowColor: 0xbb4d00,
    subtitleColor: "#79716b",
    titleColor: "#0c0a09",
  });
});

test("returns the dark palette for the dark color scheme", () => {
  expect(getHousePalette("dark")).toEqual({
    backgroundColor: "#0c0a09",
    cardBorderAlpha: 0.1,
    cardBorderColor: 0xffffff,
    cardColor: 0x1c1917,
    glowAlpha: 0.24,
    glowColor: 0x973c00,
    subtitleColor: "#a6a09b",
    titleColor: "#fafaf9",
  });
});
