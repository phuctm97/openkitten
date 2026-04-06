import { Application, extend } from "@pixi/react";
import { Container, Graphics } from "pixi.js";

extend({
  Container,
  Graphics,
});

type HouseSceneProps = {
  world: {
    cats: Array<{
      id: string;
      name: string;
      stationLabel: string;
      pose: "working" | "resting";
      accent: string;
    }>;
    whiteboard: {
      title: string;
    };
    cabinet: {
      title: string;
    };
  };
  unreadNoticeCount: number;
  worldClock: number;
  spotlightCatId: string | null;
  spotlightThreadId: string | null;
  reactionMessage: string | null;
  onShowCat: (catId: string) => void;
  onShowInbox: () => void;
  onShowWhiteboard: () => void;
  onShowCabinet: () => void;
  onShowThread: (threadId: string) => void;
};

const sceneWidth = 920;
const sceneHeight = 560;

function HouseScene({
  world,
  unreadNoticeCount,
  worldClock,
  spotlightCatId,
  spotlightThreadId,
  reactionMessage,
  onShowCat,
  onShowInbox,
  onShowWhiteboard,
  onShowCabinet,
  onShowThread,
}: HouseSceneProps) {
  const mochi = world.cats[0];
  const pepper = world.cats[1];
  const mochiGlow =
    spotlightCatId === mochi?.id || spotlightThreadId === "thread-pricing";
  const pepperGlow =
    spotlightCatId === pepper?.id || spotlightThreadId === "thread-onboarding";
  const pulse = 0.5 + Math.sin(worldClock / 1.8) * 0.5;
  const mochiBob = Math.sin((worldClock + 1) / 2) * 5;
  const pepperBob = Math.sin(worldClock / 2.4) * 3;
  const showPricingThread = () => {
    onShowThread("thread-pricing");
  };
  const showOnboardingThread = () => {
    onShowThread("thread-onboarding");
  };
  const createCatHandler = (catId: string) => () => {
    onShowCat(catId);
  };

  return (
    <section className="world-card">
      <div className="world-card__scene">
        <Application
          antialias
          autoStart
          backgroundAlpha={0}
          className="world-card__canvas"
          height={sceneHeight}
          width={sceneWidth}
        >
          <pixiContainer>
            <pixiGraphics draw={drawBackdrop} />
            <pixiGraphics
              draw={(graphics) => {
                drawInbox(graphics, unreadNoticeCount > 0, pulse);
              }}
              eventMode="static"
              onPointerTap={onShowInbox}
            />
            <pixiGraphics
              draw={(graphics) => {
                drawWhiteboard(
                  graphics,
                  spotlightThreadId === "thread-onboarding",
                );
              }}
              eventMode="static"
              onPointerTap={onShowWhiteboard}
            />
            <pixiGraphics
              draw={(graphics) => {
                drawCabinet(
                  graphics,
                  spotlightThreadId === "thread-onboarding",
                );
              }}
              eventMode="static"
              onPointerTap={onShowCabinet}
            />
            <pixiGraphics
              draw={(graphics) => {
                drawDesk(graphics, mochiGlow, pulse);
              }}
              eventMode="static"
              onPointerTap={showPricingThread}
            />
            <pixiGraphics
              draw={(graphics) => {
                drawWindowNook(graphics, pepperGlow);
              }}
              eventMode="static"
              onPointerTap={showOnboardingThread}
            />
            {mochi ? (
              <pixiGraphics
                draw={(graphics) => {
                  drawCat(graphics, {
                    accent: mochi.accent,
                    glow: mochiGlow,
                    pose: mochi.pose,
                    x: 612,
                    y: 336 + mochiBob,
                  });
                }}
                eventMode="static"
                onPointerTap={createCatHandler(mochi.id)}
              />
            ) : null}
            {pepper ? (
              <pixiGraphics
                draw={(graphics) => {
                  drawCat(graphics, {
                    accent: pepper.accent,
                    glow: pepperGlow,
                    pose: pepper.pose,
                    x: 262,
                    y: 402 + pepperBob,
                  });
                }}
                eventMode="static"
                onPointerTap={createCatHandler(pepper.id)}
              />
            ) : null}
            {reactionMessage ? (
              <pixiGraphics
                draw={(graphics) => {
                  drawReactionBubble(graphics, pulse);
                }}
              />
            ) : null}
          </pixiContainer>
        </Application>

        <button
          aria-label={`Inbox ${unreadNoticeCount} waiting`}
          className="world-card__hotspot world-card__hotspot--inbox"
          onClick={onShowInbox}
          type="button"
        >
          Inbox
          <span>{unreadNoticeCount} waiting</span>
        </button>

        <button
          aria-label="Active thread Pricing review"
          className="world-card__hotspot world-card__hotspot--thread"
          onClick={showPricingThread}
          type="button"
        >
          Active thread
          <span>Pricing review</span>
        </button>

        {mochi ? (
          <button
            aria-label={`${mochi.name} ${mochi.stationLabel}`}
            className="world-card__hotspot world-card__hotspot--mochi"
            onClick={createCatHandler(mochi.id)}
            type="button"
          >
            {mochi.name}
            <span>{mochi.stationLabel}</span>
          </button>
        ) : null}

        {pepper ? (
          <button
            aria-label={`${pepper.name} ${pepper.stationLabel}`}
            className="world-card__hotspot world-card__hotspot--pepper"
            onClick={createCatHandler(pepper.id)}
            type="button"
          >
            {pepper.name}
            <span>{pepper.stationLabel}</span>
          </button>
        ) : null}

        <button
          aria-label={`${world.whiteboard.title} House cues`}
          className="world-card__hotspot world-card__hotspot--whiteboard"
          onClick={onShowWhiteboard}
          type="button"
        >
          {world.whiteboard.title}
          <span>House cues</span>
        </button>

        <button
          aria-label={`${world.cabinet.title} Shared files`}
          className="world-card__hotspot world-card__hotspot--cabinet"
          onClick={onShowCabinet}
          type="button"
        >
          {world.cabinet.title}
          <span>Shared files</span>
        </button>
      </div>

      <div className="world-card__status">
        <div>
          <p className="world-card__eyebrow">House reaction</p>
          <p className="world-card__status-text">
            {reactionMessage ??
              "The room stays calm until you inspect something or leave a note."}
          </p>
        </div>
        <div className="world-card__pulse">
          <span aria-hidden="true" />
          Mochi&apos;s session lamp is live.
        </div>
      </div>
    </section>
  );
}

function drawBackdrop(graphics: Graphics) {
  graphics.clear();
  graphics.roundRect(18, 18, 884, 524, 42).fill({
    color: 0xf0d8b2,
  });
  graphics.roundRect(36, 36, 848, 488, 34).fill({
    color: 0xf5ebd4,
  });
  graphics.rect(36, 36, 848, 294).fill({
    color: 0xf7f1e4,
  });
  graphics.rect(36, 330, 848, 194).fill({
    color: 0xb57b4f,
  });
  graphics.roundRect(294, 344, 324, 124, 58).fill({
    color: 0xc68b5a,
  });
  graphics.roundRect(322, 364, 268, 82, 40).fill({
    color: 0xe0b386,
    alpha: 0.82,
  });
  graphics.roundRect(114, 96, 146, 126, 24).fill({
    color: 0x617596,
  });
  graphics.roundRect(126, 108, 122, 102, 18).fill({
    color: 0x9bc4d6,
  });
  graphics.rect(186, 108, 8, 102).fill({
    color: 0xf0e5d5,
  });
  graphics.rect(126, 154, 122, 8).fill({
    color: 0xf0e5d5,
  });
}

function drawInbox(graphics: Graphics, hasUnread: boolean, pulse: number) {
  graphics.clear();
  graphics.roundRect(84, 246, 118, 80, 22).fill({
    color: hasUnread ? 0xf5ac57 : 0xe4ceb0,
  });
  graphics.roundRect(84, 246, 118, 54, 22).fill({
    color: hasUnread ? 0xfcda8b : 0xf1e4cf,
  });
  graphics.moveTo(84, 300).lineTo(143, 334).lineTo(202, 300).stroke({
    color: 0x7a4d2d,
    width: 4,
  });

  if (hasUnread) {
    graphics.circle(196, 244, 12 + pulse * 3).fill({
      color: 0xfff3c4,
      alpha: 0.8,
    });
    graphics.circle(196, 244, 10).fill({
      color: 0x9b4a26,
    });
  }
}

function drawWhiteboard(graphics: Graphics, isHighlighted: boolean) {
  graphics.clear();
  graphics.roundRect(692, 94, 144, 108, 18).fill({
    color: isHighlighted ? 0xf4f0c7 : 0xf0e6d4,
  });
  graphics.roundRect(706, 110, 116, 80, 12).fill({
    color: 0xfffcf5,
  });
  graphics.stroke({
    color: 0x7c5a3f,
    width: 5,
  });
  graphics.moveTo(722, 128).lineTo(800, 128);
  graphics.moveTo(722, 148).lineTo(792, 148);
  graphics.moveTo(722, 168).lineTo(782, 168);
  graphics.stroke({
    color: 0x8f6f4d,
    width: 4,
  });
}

function drawCabinet(graphics: Graphics, isHighlighted: boolean) {
  graphics.clear();
  graphics.roundRect(724, 352, 132, 132, 24).fill({
    color: isHighlighted ? 0xa96b42 : 0x8b5634,
  });
  graphics.roundRect(738, 370, 104, 98, 16).fill({
    color: 0xc98f5e,
  });
  graphics.rect(790, 370, 4, 98).fill({
    color: 0x6a3c23,
  });
  graphics.circle(782, 420, 4).fill({
    color: 0x5f311d,
  });
  graphics.circle(802, 420, 4).fill({
    color: 0x5f311d,
  });
}

function drawDesk(graphics: Graphics, isHighlighted: boolean, pulse: number) {
  graphics.clear();

  if (isHighlighted) {
    graphics.roundRect(500, 246, 220, 164, 38).fill({
      color: 0xffe29f,
      alpha: 0.28 + pulse * 0.12,
    });
  }

  graphics.roundRect(544, 284, 152, 26, 12).fill({
    color: 0x835436,
  });
  graphics.rect(564, 308, 18, 92).fill({
    color: 0x6f452b,
  });
  graphics.rect(652, 308, 18, 92).fill({
    color: 0x6f452b,
  });
  graphics.roundRect(566, 252, 108, 54, 18).fill({
    color: 0xdcb183,
  });
  graphics.roundRect(592, 222, 48, 42, 14).fill({
    color: 0xf7d38f,
  });
  graphics.roundRect(606, 204, 18, 22, 10).fill({
    color: 0xffedbb,
  });
  graphics.circle(640, 248, 12).fill({
    color: 0xf5c16f,
    alpha: 0.65 + pulse * 0.15,
  });
  graphics.circle(640, 248, 7).fill({
    color: 0xfff1be,
  });
}

function drawWindowNook(graphics: Graphics, isHighlighted: boolean) {
  graphics.clear();

  if (isHighlighted) {
    graphics.roundRect(164, 330, 178, 142, 48).fill({
      color: 0xc8dcf0,
      alpha: 0.2,
    });
  }

  graphics.roundRect(196, 386, 118, 54, 30).fill({
    color: 0x7c8fa5,
  });
  graphics.roundRect(208, 396, 94, 36, 24).fill({
    color: 0xc8d8ea,
  });
  graphics.roundRect(232, 318, 56, 84, 24).fill({
    color: 0x8aa17f,
  });
  graphics.circle(260, 302, 26).fill({
    color: 0xb9d3a9,
  });
}

function drawCat(
  graphics: Graphics,
  options: {
    x: number;
    y: number;
    accent: string;
    pose: "working" | "resting";
    glow: boolean;
  },
) {
  const accentColor = Number.parseInt(options.accent.replace("#", "0x"), 16);
  const bodyColor = options.pose === "working" ? 0xf7e1bf : 0xd5ddec;
  const earOffset = options.pose === "working" ? 24 : 20;
  const headY = options.pose === "working" ? options.y - 42 : options.y - 36;
  const bodyY = options.pose === "working" ? options.y : options.y + 2;

  graphics.clear();

  if (options.glow) {
    graphics.ellipse(options.x, options.y + 16, 66, 40).fill({
      color: accentColor,
      alpha: 0.18,
    });
  }

  graphics.ellipse(options.x, bodyY + 28, 58, 24).fill({
    color: 0x5d412f,
    alpha: 0.16,
  });

  graphics.ellipse(options.x, bodyY, 52, 36).fill({
    color: bodyColor,
  });
  graphics.circle(options.x, headY, 26).fill({
    color: bodyColor,
  });
  graphics
    .moveTo(options.x - 18, headY - 16)
    .lineTo(options.x - 6, headY - earOffset)
    .lineTo(options.x + 2, headY - 14)
    .stroke({
      color: bodyColor,
      width: 10,
      cap: "round",
      join: "round",
    });
  graphics
    .moveTo(options.x + 18, headY - 16)
    .lineTo(options.x + 6, headY - earOffset)
    .lineTo(options.x - 2, headY - 14)
    .stroke({
      color: bodyColor,
      width: 10,
      cap: "round",
      join: "round",
    });
  graphics.circle(options.x - 10, headY - 2, 3).fill({
    color: 0x473126,
  });
  graphics.circle(options.x + 10, headY - 2, 3).fill({
    color: 0x473126,
  });
  graphics
    .moveTo(options.x - 6, headY + 9)
    .lineTo(options.x + 6, headY + 9)
    .stroke({
      color: 0x8f604d,
      width: 3,
      cap: "round",
    });
  graphics
    .moveTo(options.x + 36, bodyY + 8)
    .quadraticCurveTo(options.x + 64, bodyY - 12, options.x + 58, bodyY - 40)
    .stroke({
      color: bodyColor,
      width: 10,
      cap: "round",
    });
  graphics.roundRect(options.x - 28, bodyY + 4, 56, 10, 8).fill({
    color: accentColor,
  });
}

function drawReactionBubble(graphics: Graphics, pulse: number) {
  graphics.clear();
  graphics.roundRect(548, 118, 184, 42, 18).fill({
    color: 0xfff6dc,
    alpha: 0.72 + pulse * 0.08,
  });
  graphics
    .moveTo(596, 160)
    .lineTo(618, 184)
    .lineTo(628, 156)
    .fill({
      color: 0xfff6dc,
      alpha: 0.72 + pulse * 0.08,
    });
}

export { HouseScene };
