import type { ColorScheme } from "~/lib/color-scheme";
import type { HousePalette } from "~/lib/house-pallete";

const lightPalette: HousePalette = {
  backgroundColor: "#ffffff",
  cardBorderAlpha: 1,
  cardBorderColor: 0xe7e5e4,
  cardColor: 0xffffff,
  glowAlpha: 0.16,
  glowColor: 0xbb4d00,
  subtitleColor: "#79716b",
  titleColor: "#0c0a09",
};

const darkPalette: HousePalette = {
  backgroundColor: "#0c0a09",
  cardBorderAlpha: 0.1,
  cardBorderColor: 0xffffff,
  cardColor: 0x1c1917,
  glowAlpha: 0.24,
  glowColor: 0x973c00,
  subtitleColor: "#a6a09b",
  titleColor: "#fafaf9",
};

export function getHousePalette(colorScheme: ColorScheme) {
  return colorScheme === "dark" ? darkPalette : lightPalette;
}
