import { expect, test } from "vitest";

import { getHousePalette } from "~/lib/get-house-palette";

test("returns the light palette for the light color scheme", () => {
  expect(getHousePalette("light")).toEqual({
    ambientShadowAlpha: 0,
    ambientShadowColor: 0x09090b,
    backgroundColor: "#ffffff",
  });
});

test("returns the dark palette for the dark color scheme", () => {
  expect(getHousePalette("dark")).toEqual({
    ambientShadowAlpha: 0.22,
    ambientShadowColor: 0x09090b,
    backgroundColor: "#09090b",
  });
});
