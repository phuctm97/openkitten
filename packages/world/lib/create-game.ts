import * as Phaser from "phaser";
import { HouseScene } from "~/lib/house-scene";

export function createGame(parent: HTMLElement) {
  return new Phaser.Game({
    parent,
    scale: { mode: Phaser.Scale.RESIZE },
    scene: [HouseScene],
  });
}
