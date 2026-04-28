import type { ColorScheme } from "~/lib/color-scheme";
import type { HousePalette } from "~/lib/house-palette";

const lightPalette: HousePalette = {
  ambientShadowAlpha: 0,
  ambientShadowColor: 0x09090b,
  backgroundColor: "#ffffff",
};

const darkPalette: HousePalette = {
  ambientShadowAlpha: 0.22,
  ambientShadowColor: 0x09090b,
  backgroundColor: "#09090b",
};

export function getHousePalette(colorScheme: ColorScheme) {
  return colorScheme === "dark" ? darkPalette : lightPalette;
}
