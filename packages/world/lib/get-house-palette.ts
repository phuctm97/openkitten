import type { ColorScheme } from "~/lib/color-scheme";
import type { HousePalette } from "~/lib/house-palette";

const lightPalette: HousePalette = {
  backgroundColor: "#ffffff",
};

const darkPalette: HousePalette = {
  backgroundColor: "#0c0a09",
};

export function getHousePalette(colorScheme: ColorScheme) {
  return colorScheme === "dark" ? darkPalette : lightPalette;
}
