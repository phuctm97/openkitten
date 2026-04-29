import * as Phaser from "phaser";
import { AmbientHouseScene } from "~/lib/ambient-house-scene";
import { getColorScheme } from "~/lib/get-color-scheme";
import { getHousePalette } from "~/lib/get-house-palette";

export function createAmbientGame(parent: HTMLElement) {
  const { backgroundColor } = getHousePalette(getColorScheme());

  return new Phaser.Game({
    parent,
    backgroundColor,
    scale: { mode: Phaser.Scale.RESIZE },
    scene: [AmbientHouseScene],
    input: { keyboard: false, mouse: false, touch: false },
    audio: { noAudio: true },
  });
}
