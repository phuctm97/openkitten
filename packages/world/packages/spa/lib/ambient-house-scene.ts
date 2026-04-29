import * as Phaser from "phaser";
import awakeCatTexturePath from "~/assets/cat-a-awake-v1.webp";
import restingCatTexturePath from "~/assets/cat-b-resting-v1.webp";
import roomShellTexturePath from "~/assets/house-room-shell-v1.webp";
import { getColorScheme } from "~/lib/get-color-scheme";
import { getHousePalette } from "~/lib/get-house-palette";

const awakeCatFloorXRatio = 0.36;
const awakeCatFloorYRatio = 0.71;
const awakeCatOriginY = 0.95;
const awakeCatSizeRatio = 0.26;
const awakeCatTextureKey = "ambient-cat-a-awake";
const restingCatFloorXRatio = 0.59;
const restingCatFloorYRatio = 0.73;
const restingCatOriginY = 0.78;
const restingCatSizeRatio = 0.28;
const restingCatTextureKey = "ambient-cat-b-resting";
const roomShellTextureKey = "ambient-room-shell";
const roomShellHeight = 1024;
const roomShellWidth = 1536;
const breathingPixels = 2;
const breathingDurationMs = 4200;

type AmbientHouseView = {
  awakeCat: Phaser.GameObjects.Image;
  restingCat: Phaser.GameObjects.Image;
  ambientShadow: Phaser.GameObjects.Rectangle;
  roomShell: Phaser.GameObjects.Image;
};

function getContainScale(width: number, height: number) {
  return Math.min(width / roomShellWidth, height / roomShellHeight);
}

export class AmbientHouseScene extends Phaser.Scene {
  static readonly key = "ambient-house";

  private colorSchemeObserver: MutationObserver | null = null;
  private view: AmbientHouseView | null = null;

  constructor() {
    super(AmbientHouseScene.key);
  }

  preload() {
    this.load.image(roomShellTextureKey, roomShellTexturePath);
    this.load.image(awakeCatTextureKey, awakeCatTexturePath);
    this.load.image(restingCatTextureKey, restingCatTexturePath);
  }

  create() {
    const palette = getHousePalette(getColorScheme());
    const roomShell = this.add.image(0, 0, roomShellTextureKey).setOrigin(0.5);
    const awakeCat = this.add
      .image(0, 0, awakeCatTextureKey)
      .setOrigin(0.5, awakeCatOriginY);
    const restingCat = this.add
      .image(0, 0, restingCatTextureKey)
      .setOrigin(0.5, restingCatOriginY);
    const ambientShadow = this.add
      .rectangle(
        0,
        0,
        1,
        1,
        palette.ambientShadowColor,
        palette.ambientShadowAlpha,
      )
      .setOrigin(0.5)
      .setDepth(1);

    this.view = { awakeCat, restingCat, ambientShadow, roomShell };

    this.game.canvas.style.touchAction = "none";
    this.input.enabled = false;
    this.syncPalette();
    this.layout();

    this.tweens.add({
      targets: awakeCat,
      y: `+=${breathingPixels}`,
      duration: breathingDurationMs,
      ease: Phaser.Math.Easing.Sine.InOut,
      yoyo: true,
      repeat: -1,
    });
    this.tweens.add({
      targets: restingCat,
      y: `+=${breathingPixels * 0.6}`,
      duration: breathingDurationMs * 1.2,
      ease: Phaser.Math.Easing.Sine.InOut,
      yoyo: true,
      repeat: -1,
    });

    this.colorSchemeObserver = new MutationObserver(() => this.syncPalette());
    this.colorSchemeObserver.observe(document.documentElement, {
      attributeFilter: ["style"],
      attributes: true,
    });
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  private handleResize() {
    this.layout();
  }

  private handleShutdown() {
    this.colorSchemeObserver?.disconnect();
    this.colorSchemeObserver = null;
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.view = null;
  }

  private syncPalette() {
    const view = this.view;
    if (view === null) return;
    const palette = getHousePalette(getColorScheme());
    view.ambientShadow.setFillStyle(
      palette.ambientShadowColor,
      palette.ambientShadowAlpha,
    );
    this.cameras.main.setBackgroundColor(palette.backgroundColor);
    this.game.canvas.style.backgroundColor = palette.backgroundColor;
  }

  private layout() {
    const view = this.view;
    if (view === null) return;
    const { width, height } = this.scale;
    const scale = getContainScale(width, height);
    const displayWidth = roomShellWidth * scale;
    const displayHeight = roomShellHeight * scale;
    const camera = this.cameras.main;

    camera.setSize(width, height);
    camera.setViewport(0, 0, width, height);

    view.roomShell.setDisplaySize(displayWidth, displayHeight);
    view.roomShell.setPosition(width / 2, height / 2);
    view.ambientShadow.setDisplaySize(displayWidth, displayHeight);
    view.ambientShadow.setPosition(width / 2, height / 2);

    const originX = width / 2 - displayWidth / 2;
    const originY = height / 2 - displayHeight / 2;
    const awakeCatSize = displayHeight * awakeCatSizeRatio;
    const restingCatSize = displayHeight * restingCatSizeRatio;

    view.awakeCat.setDisplaySize(awakeCatSize, awakeCatSize);
    view.awakeCat.setPosition(
      originX + displayWidth * awakeCatFloorXRatio,
      originY + displayHeight * awakeCatFloorYRatio,
    );
    view.restingCat.setDisplaySize(restingCatSize, restingCatSize);
    view.restingCat.setPosition(
      originX + displayWidth * restingCatFloorXRatio,
      originY + displayHeight * restingCatFloorYRatio,
    );
  }
}
