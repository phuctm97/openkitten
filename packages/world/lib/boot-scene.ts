import Phaser from "phaser";
import { HouseScene } from "~/lib/house-scene";
import { worldAssets } from "~/lib/world-assets";

export class BootScene extends Phaser.Scene {
  static readonly key = "boot";

  constructor() {
    super(BootScene.key);
  }

  preload() {
    worldAssets.preloadEntries.forEach((asset) => {
      this.load.image(asset.key, asset.path);
    });
  }

  create() {
    this.scene.start(HouseScene.key);
  }
}
