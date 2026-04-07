import Phaser from "phaser";
import { HouseScene } from "~/lib/house-scene";

export class BootScene extends Phaser.Scene {
  static readonly key = "boot";

  constructor() {
    super(BootScene.key);
  }

  create() {
    this.scene.start(HouseScene.key);
  }
}
