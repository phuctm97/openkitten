import Phaser from "phaser";
import { getColorScheme } from "~/lib/get-color-scheme";
import { getHousePalette } from "~/lib/get-house-palette";
import { houseLayout } from "~/lib/house-layout";
import { worldAssets } from "~/lib/world-assets";

type CatView = {
  data: (typeof houseLayout.cats)[number];
  shadow: Phaser.GameObjects.Image;
  sprite: Phaser.GameObjects.Image;
};

type HouseView = {
  ambientShade: Phaser.GameObjects.Rectangle;
  background: Phaser.GameObjects.Image;
  cats: CatView[];
};

export class HouseScene extends Phaser.Scene {
  static readonly key = "house";

  private colorSchemeObserver: MutationObserver | null = null;
  private view: HouseView | null = null;
  private worldOffsetX = 0;
  private worldOffsetY = 0;
  private worldScale = 1;

  constructor() {
    super(HouseScene.key);
  }

  create() {
    const background = this.add
      .image(0, 0, worldAssets.backgrounds.roomShell.key)
      .setOrigin(0, 0)
      .setDepth(0);
    const ambientShade = this.add
      .rectangle(
        0,
        0,
        houseLayout.sceneSize.width,
        houseLayout.sceneSize.height,
        0x120c08,
        0,
      )
      .setOrigin(0, 0)
      .setDepth(40);
    const cats = houseLayout.cats.map((cat) => {
      const shadow = this.add
        .image(0, 0, worldAssets.fx.catShadow.key)
        .setAlpha(cat.shadowAlpha)
        .setDepth(cat.depth - 2)
        .setOrigin(0.5);
      const sprite = this.add
        .image(0, 0, cat.textureKey)
        .setDepth(cat.depth)
        .setOrigin(0.5);

      return {
        data: cat,
        shadow,
        sprite,
      };
    });

    this.view = {
      ambientShade,
      background,
      cats,
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
    const colorScheme = getColorScheme();
    const ambientShadeAlpha = colorScheme === "dark" ? 0.2 : 0.04;

    view.ambientShade.setFillStyle(0x120c08, ambientShadeAlpha);
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
    const sceneWidth = houseLayout.sceneSize.width;
    const sceneHeight = houseLayout.sceneSize.height;
    const portrait = height > width;
    const focusX = portrait ? 0.44 : 0.5;

    this.worldScale = Math.max(width / sceneWidth, height / sceneHeight);
    this.worldOffsetX = width * 0.5 - sceneWidth * this.worldScale * focusX;
    this.worldOffsetY = (height - sceneHeight * this.worldScale) / 2;

    view.background
      .setDisplaySize(
        sceneWidth * this.worldScale,
        sceneHeight * this.worldScale,
      )
      .setPosition(this.worldOffsetX, this.worldOffsetY);
    view.ambientShade
      .setPosition(this.worldOffsetX, this.worldOffsetY)
      .setSize(sceneWidth * this.worldScale, sceneHeight * this.worldScale);
    view.cats.forEach((cat) => {
      cat.shadow
        .setPosition(
          this.worldOffsetX + cat.data.shadowX * this.worldScale,
          this.worldOffsetY + cat.data.shadowY * this.worldScale,
        )
        .setScale(cat.data.shadowScale * this.worldScale);
      cat.sprite
        .setPosition(
          this.worldOffsetX + cat.data.x * this.worldScale,
          this.worldOffsetY + cat.data.y * this.worldScale,
        )
        .setScale(cat.data.scale * this.worldScale);
    });
  }
}
