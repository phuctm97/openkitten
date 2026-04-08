import Phaser from "phaser";
import { BootScene } from "~/lib/boot-scene";
import { HouseScene } from "~/lib/house-scene";

export function createGame(parent: HTMLElement) {
  return new Phaser.Game({
    parent,
    scale: {
      mode: Phaser.Scale.RESIZE,
    },
    scene: [BootScene, HouseScene],
    backgroundColor: "#ffffff",
  });
}
