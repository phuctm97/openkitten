import Phaser from "phaser";
import { BootScene } from "~/lib/boot-scene";
import { getColorScheme } from "~/lib/get-color-scheme";
import { getHousePalette } from "~/lib/get-house-palette";
import { HouseScene } from "~/lib/house-scene";

export function createGame(parent: HTMLElement) {
  const { backgroundColor } = getHousePalette(getColorScheme());

  return new Phaser.Game({
    parent,
    backgroundColor,
    roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE },
    scene: [BootScene, HouseScene],
  });
}
