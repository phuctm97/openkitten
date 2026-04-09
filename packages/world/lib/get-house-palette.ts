import type { ColorScheme } from "~/lib/color-scheme";
import type { HousePalette } from "~/lib/house-palette";

const lightPalette: HousePalette = {
  ambientShadowAlpha: 0,
  ambientShadowColor: 0x120d0b,
  backgroundColor: "#ffffff",
};

const darkPalette: HousePalette = {
  ambientShadowAlpha: 0.22,
  ambientShadowColor: 0x120d0b,
  backgroundColor: "#0c0a09",
};

export function getHousePalette(colorScheme: ColorScheme) {
  return colorScheme === "dark" ? darkPalette : lightPalette;
}
