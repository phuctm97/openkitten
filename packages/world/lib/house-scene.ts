import Phaser from "phaser";
import { getColorScheme } from "~/lib/get-color-scheme";
import { getHousePalette } from "~/lib/get-house-palette";
import { houseLayout } from "~/lib/house-layout";
import { worldAssets } from "~/lib/world-assets";

type InspectableView = {
  data: (typeof houseLayout.inspectables)[number];
  glow: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image | null;
  sprite: Phaser.GameObjects.Image;
};

type InspectId = (typeof houseLayout.inspectables)[number]["id"];

type HouseView = {
  ambientDecorations: Phaser.GameObjects.Image[];
  ambientShade: Phaser.GameObjects.Rectangle;
  background: Phaser.GameObjects.Image;
  inspectables: InspectableView[];
  panelAccent: Phaser.GameObjects.Rectangle;
  panelBody: Phaser.GameObjects.Text;
  panelCard: Phaser.GameObjects.Rectangle;
  panelFrame: Phaser.GameObjects.Image;
  panelGlow: Phaser.GameObjects.Rectangle;
  panelMeta: Phaser.GameObjects.Text;
  panelTitle: Phaser.GameObjects.Text;
  trim: Phaser.GameObjects.Image;
  hoverRing: Phaser.GameObjects.Image;
};

const glowTint = 0xffd78b;
const panelAlpha = 0.9;
const panelGlowPadding = 24;

export class HouseScene extends Phaser.Scene {
  static readonly key = "house";

  private colorSchemeObserver: MutationObserver | null = null;
  private hoveredInspectId: InspectId | null = null;
  private selectedInspectId: InspectId = houseLayout.defaultInspectId;
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
    const ambientDecorations = houseLayout.ambientDecorations.map(
      (decoration) =>
        this.add
          .image(0, 0, decoration.textureKey)
          .setAlpha(decoration.alpha)
          .setDepth(decoration.depth)
          .setOrigin(0.5),
    );
    const inspectables = houseLayout.inspectables.map((inspectable) => {
      const shadow =
        inspectable.shadowScale === null
          ? null
          : this.add
              .image(0, 0, worldAssets.fx.catShadow.key)
              .setAlpha(inspectable.shadowAlpha ?? 0)
              .setDepth(inspectable.depth - 2)
              .setOrigin(0.5);
      const glow = this.add
        .image(0, 0, inspectable.textureKey)
        .setAlpha(0)
        .setDepth(inspectable.depth - 1)
        .setOrigin(0.5)
        .setTint(glowTint);
      const sprite = this.add
        .image(0, 0, inspectable.textureKey)
        .setDepth(inspectable.depth)
        .setInteractive({ useHandCursor: true })
        .setOrigin(0.5);

      sprite.on("pointerdown", () => {
        this.selectedInspectId = inspectable.id;
        this.refreshFocus();
      });
      sprite.on("pointerout", () => {
        if (this.hoveredInspectId === inspectable.id) {
          this.hoveredInspectId = null;
          this.refreshFocus();
        }
      });
      sprite.on("pointerover", () => {
        this.hoveredInspectId = inspectable.id;
        this.refreshFocus();
      });

      return {
        data: inspectable,
        glow,
        shadow,
        sprite,
      };
    });
    const trim = this.add
      .image(0, 0, worldAssets.backgrounds.foregroundTrim.key)
      .setDepth(2_000)
      .setOrigin(0, 0);
    const hoverRing = this.add
      .image(0, 0, worldAssets.fx.hoverRing.key)
      .setAlpha(0.78)
      .setDepth(650)
      .setOrigin(0.5)
      .setVisible(false);
    const panelGlow = this.add
      .rectangle(
        0,
        0,
        houseLayout.panel.width + panelGlowPadding,
        houseLayout.panel.height + panelGlowPadding,
        0,
        0,
      )
      .setDepth(2_090)
      .setOrigin(0.5);
    const panelCard = this.add
      .rectangle(
        0,
        0,
        houseLayout.panel.width,
        houseLayout.panel.height,
        0,
        panelAlpha,
      )
      .setDepth(2_100)
      .setOrigin(0.5);
    const panelFrame = this.add
      .image(0, 0, worldAssets.ui.inspectPanel.key)
      .setDepth(2_110)
      .setOrigin(0.5);
    const panelAccent = this.add
      .rectangle(0, 0, houseLayout.panel.accentWidth, 4, 0, 1)
      .setDepth(2_120)
      .setOrigin(0.5);
    const panelTitle = this.add
      .text(0, 0, "", {
        color: "#fafaf9",
        fontFamily: '"Oxanium Variable", sans-serif',
        fontSize: `${houseLayout.panel.titleFontSize}px`,
        fontStyle: "700",
      })
      .setDepth(2_130)
      .setOrigin(0, 0.5);
    const panelMeta = this.add
      .text(0, 0, "", {
        color: "#a6a09b",
        fontFamily: '"Azeret Mono Variable", monospace',
        fontSize: `${houseLayout.panel.metaFontSize}px`,
      })
      .setDepth(2_130)
      .setOrigin(0, 0.5);
    const panelBody = this.add
      .text(0, 0, "", {
        color: "#e7e5e4",
        fontFamily: '"Azeret Mono Variable", monospace',
        fontSize: `${houseLayout.panel.bodyFontSize}px`,
        lineSpacing: houseLayout.panel.descriptionLineSpacing,
      })
      .setDepth(2_130)
      .setOrigin(0, 0);

    this.view = {
      ambientDecorations,
      ambientShade,
      background,
      hoverRing,
      inspectables,
      panelAccent,
      panelBody,
      panelCard,
      panelFrame,
      panelGlow,
      panelMeta,
      panelTitle,
      trim,
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
    view.panelGlow.setFillStyle(palette.glowColor, palette.glowAlpha + 0.08);
    view.panelCard.setFillStyle(palette.cardColor, panelAlpha);
    view.panelCard.setStrokeStyle(
      2,
      palette.cardBorderColor,
      palette.cardBorderAlpha,
    );
    view.panelAccent.setFillStyle(palette.glowColor, 1);
    view.panelTitle.setColor(palette.titleColor);
    view.panelMeta.setColor(palette.subtitleColor);
    view.panelBody.setColor(palette.titleColor);
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
    const panelScale = Math.min(1, Math.max(0.72, width / 1_400));
    const panelWidth = houseLayout.panel.width * panelScale;
    const panelHeight = houseLayout.panel.height * panelScale;
    const portrait = height > width;
    const focusX = portrait ? 0.44 : 0.5;
    const panelY = height - panelHeight * (width < 640 ? 1.26 : 1.08);

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
    view.trim
      .setDisplaySize(
        sceneWidth * this.worldScale,
        sceneHeight * this.worldScale,
      )
      .setPosition(this.worldOffsetX, this.worldOffsetY);

    view.ambientDecorations.forEach((decoration, index) => {
      const layoutDecoration = houseLayout.ambientDecorations[index];

      if (layoutDecoration === undefined) {
        return;
      }

      decoration
        .setPosition(
          this.worldOffsetX + layoutDecoration.x * this.worldScale,
          this.worldOffsetY + layoutDecoration.y * this.worldScale,
        )
        .setScale(layoutDecoration.scale * this.worldScale);
    });

    view.panelGlow.setPosition(width / 2, panelY);
    view.panelGlow.setSize(
      panelWidth + panelGlowPadding * panelScale,
      panelHeight + panelGlowPadding * panelScale,
    );
    view.panelCard.setPosition(width / 2, panelY);
    view.panelCard.setSize(panelWidth, panelHeight);
    view.panelFrame
      .setDisplaySize(
        panelWidth + 180 * panelScale,
        panelHeight + 108 * panelScale,
      )
      .setPosition(width / 2, panelY);
    view.panelAccent.setPosition(width / 2, panelY - panelHeight * 0.38);
    view.panelAccent.setSize(houseLayout.panel.accentWidth * panelScale, 4);
    view.panelTitle
      .setFontSize(
        `${Math.round(houseLayout.panel.titleFontSize * panelScale)}px`,
      )
      .setPosition(
        width / 2 - panelWidth / 2 + 28 * panelScale,
        panelY - panelHeight * 0.24,
      );
    view.panelMeta
      .setFontSize(
        `${Math.round(houseLayout.panel.metaFontSize * panelScale)}px`,
      )
      .setPosition(
        width / 2 - panelWidth / 2 + 28 * panelScale,
        panelY - panelHeight * 0.01,
      );
    view.panelBody
      .setFontSize(
        `${Math.round(houseLayout.panel.bodyFontSize * panelScale * 0.95)}px`,
      )
      .setPosition(
        width / 2 - panelWidth / 2 + 28 * panelScale,
        panelY + panelHeight * 0.1,
      )
      .setWordWrapWidth(panelWidth - 56 * panelScale, true);

    this.refreshFocus();
  }

  private refreshFocus() {
    const view = this.view;

    if (view === null) {
      return;
    }

    const focusedInspectId = this.hoveredInspectId ?? this.selectedInspectId;
    const focusedInspectable =
      view.inspectables.find(
        (inspectable) => inspectable.data.id === focusedInspectId,
      ) ?? view.inspectables[0];

    if (focusedInspectable === undefined) {
      return;
    }

    view.inspectables.forEach((inspectable) => {
      const isFocused = inspectable.data.id === focusedInspectable.data.id;
      const spriteX = this.worldOffsetX + inspectable.data.x * this.worldScale;
      const spriteY = this.worldOffsetY + inspectable.data.y * this.worldScale;
      const spriteScale =
        inspectable.data.scale *
        this.worldScale *
        (isFocused ? inspectable.data.focusScale : 1);

      inspectable.glow
        .setAlpha(isFocused ? inspectable.data.glowAlpha : 0)
        .setPosition(spriteX, spriteY)
        .setScale(spriteScale * 1.05);
      inspectable.sprite.setPosition(spriteX, spriteY).setScale(spriteScale);
      inspectable.shadow
        ?.setAlpha(
          isFocused
            ? (inspectable.data.shadowAlpha ?? 0) + 0.08
            : (inspectable.data.shadowAlpha ?? 0),
        )
        .setPosition(
          this.worldOffsetX +
            (inspectable.data.ringX ?? inspectable.data.x) * this.worldScale,
          this.worldOffsetY +
            (inspectable.data.ringY ?? inspectable.data.y) * this.worldScale,
        )
        .setScale(
          (inspectable.data.shadowScale ?? 0) *
            this.worldScale *
            (isFocused ? 1.04 : 1),
        );
    });

    if (
      focusedInspectable.data.ringScale === null ||
      focusedInspectable.data.ringX === null ||
      focusedInspectable.data.ringY === null
    ) {
      view.hoverRing.setVisible(false);
    } else {
      view.hoverRing
        .setDepth(focusedInspectable.data.depth - 1.5)
        .setPosition(
          this.worldOffsetX + focusedInspectable.data.ringX * this.worldScale,
          this.worldOffsetY + focusedInspectable.data.ringY * this.worldScale,
        )
        .setScale(focusedInspectable.data.ringScale * this.worldScale)
        .setVisible(true);
    }

    view.panelTitle.setText(focusedInspectable.data.title);
    view.panelMeta.setText(focusedInspectable.data.meta);
    view.panelBody.setText(focusedInspectable.data.description);
  }
}
