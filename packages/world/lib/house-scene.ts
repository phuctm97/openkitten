import Phaser from "phaser";
import { getColorScheme } from "~/lib/get-color-scheme";
import { getHousePalette } from "~/lib/get-house-palette";

type HouseView = {
  ambientShadow: Phaser.GameObjects.Rectangle;
  roomShell: Phaser.GameObjects.Image;
};

const ambientShadowHeight = 1;
const ambientShadowWidth = 1;
const roomShellHeight = 1024;
const roomShellTextureKey = "house-room-shell-v1";
const roomShellTexturePath = "/world/v1/backgrounds/house-room-shell-v1.png";
const roomShellWidth = 1536;

function getCoverSize(width: number, height: number) {
  const scale = Math.max(width / roomShellWidth, height / roomShellHeight);

  return {
    displayHeight: roomShellHeight * scale,
    displayWidth: roomShellWidth * scale,
  };
}

export class HouseScene extends Phaser.Scene {
  static readonly key = "house";

  private colorSchemeObserver: MutationObserver | null = null;
  private view: HouseView | null = null;

  constructor() {
    super(HouseScene.key);
  }

  preload() {
    this.load.image(roomShellTextureKey, roomShellTexturePath);
  }

  create() {
    const palette = getHousePalette(getColorScheme());
    const roomShell = this.add.image(0, 0, roomShellTextureKey).setOrigin(0.5);
    const ambientShadow = this.add
      .rectangle(
        0,
        0,
        ambientShadowWidth,
        ambientShadowHeight,
        palette.ambientShadowColor,
        palette.ambientShadowAlpha,
      )
      .setOrigin(0.5);

    this.view = {
      ambientShadow,
      roomShell,
    };

    this.syncPalette();
    this.layout();
    this.colorSchemeObserver = new MutationObserver(() => {
      this.syncPalette();
    });
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

    if (view === null) {
      return;
    }

    const palette = getHousePalette(getColorScheme());
    const backgroundColor = Phaser.Display.Color.ValueToColor(
      palette.backgroundColor,
    );

    view.ambientShadow.setFillStyle(
      palette.ambientShadowColor,
      palette.ambientShadowAlpha,
    );
    this.cameras.main.setBackgroundColor(palette.backgroundColor);
    this.game.canvas.style.backgroundColor = palette.backgroundColor;
    Object.assign(this.game.renderer.config, {
      backgroundColor,
    });
  }

  private layout() {
    const view = this.view;

    if (view === null) {
      return;
    }

    const { height, width } = this.scale;
    const { displayHeight, displayWidth } = getCoverSize(width, height);

    view.ambientShadow.setDisplaySize(width, height);
    view.ambientShadow.setPosition(width / 2, height / 2);
    view.roomShell.setDisplaySize(displayWidth, displayHeight);
    view.roomShell.setPosition(width / 2, height / 2);
  }
}
