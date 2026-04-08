import Phaser from "phaser";

type HouseView = {
  card: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  panel: Phaser.GameObjects.Container;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text;
};

const cardColor = 0x132034;
const glowColor = 0x22d3ee;
const cardBorderColor = 0x38bdf8;
const subtitleColor = "#d6d3d1";
const titleColor = "#fafaf9";
const cardHeight = 280;
const cardWidth = 560;
const glowHeight = 332;
const glowWidth = 612;

export class HouseScene extends Phaser.Scene {
  static readonly key = "house";

  private view: HouseView | null = null;

  constructor() {
    super(HouseScene.key);
  }

  create() {
    const glow = this.add
      .rectangle(0, 0, glowWidth, glowHeight, glowColor, 0.16)
      .setOrigin(0.5);
    const card = this.add
      .rectangle(0, 0, cardWidth, cardHeight, cardColor, 0.96)
      .setOrigin(0.5)
      .setStrokeStyle(2, cardBorderColor, 0.78);
    const title = this.add
      .text(0, -48, "OpenKitten", {
        color: titleColor,
        fontFamily: '"Oxanium Variable", sans-serif',
        fontSize: "42px",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(
        0,
        28,
        "Phaser is running fullscreen on `/`.\nThe real House comes next.",
        {
          align: "center",
          color: subtitleColor,
          fontFamily: '"Azeret Mono Variable", monospace',
          fontSize: "16px",
          lineSpacing: 8,
        },
      )
      .setOrigin(0.5);
    const panel = this.add.container(
      this.scale.width / 2,
      this.scale.height / 2,
      [glow, card, title, subtitle],
    );

    this.view = {
      card,
      glow,
      panel,
      title,
      subtitle,
    };

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  private handleResize() {
    this.layout();
  }

  private handleShutdown() {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.view = null;
  }

  private layout() {
    const view = this.view;

    if (view === null) {
      return;
    }

    const { height, width } = this.scale;
    const compact = width < 640;
    const panelWidth = compact ? Math.max(width - 48, 280) : cardWidth;
    const panelHeight = compact ? 240 : cardHeight;

    view.glow.setSize(panelWidth + 52, panelHeight + 52);
    view.card.setSize(panelWidth, panelHeight);
    view.panel.setPosition(width / 2, height / 2);
    view.title.setFontSize(compact ? "30px" : "42px");
    view.title.setY(compact ? -38 : -48);
    view.subtitle.setWordWrapWidth(panelWidth - 64, true);
    view.subtitle.setY(compact ? 18 : 28);
  }
}
