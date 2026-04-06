import type { Graphics } from "pixi.js";

function drawWorkingCat(
  graphics: Graphics,
  x: number,
  y: number,
  scale: number,
  pulse: number,
) {
  graphics
    .ellipse(x - scale * 0.04, y + scale * 0.44, scale * 1.08, scale * 0.22)
    .fill({ color: 0x20140f, alpha: 0.2 });

  graphics
    .ellipse(x - scale * 0.14, y, scale * 0.8, scale * 0.46)
    .fill({ color: 0xf0c18a });
  graphics
    .ellipse(x - scale * 0.74, y + scale * 0.12, scale * 0.34, scale * 0.12)
    .fill({ color: 0xf0c18a, alpha: 0.94 });
  graphics
    .ellipse(x - scale * 0.12, y + scale * 0.18, scale * 0.26, scale * 0.14)
    .fill({ color: 0xffddb5, alpha: 0.35 });
  graphics
    .circle(x + scale * 0.56, y - scale * 0.16, scale * 0.31)
    .fill({ color: 0xf0c18a });
  graphics
    .circle(x + scale * 0.42, y - scale * 0.32, scale * 0.12)
    .fill({ color: 0xffdeb5 });
  graphics
    .circle(x + scale * 0.72, y - scale * 0.34, scale * 0.12)
    .fill({ color: 0xffdeb5 });
  graphics
    .ellipse(x + scale * 0.08, y + scale * 0.4, scale * 0.11, scale * 0.06)
    .fill({ color: 0xffe6c6, alpha: 0.9 });
  graphics
    .ellipse(x + scale * 0.34, y + scale * 0.4, scale * 0.11, scale * 0.06)
    .fill({ color: 0xffe6c6, alpha: 0.9 });
  graphics
    .circle(x + scale * 0.48, y - scale * 0.12, scale * 0.035)
    .fill({ color: 0x35241c });
  graphics
    .circle(x + scale * 0.67, y - scale * 0.11, scale * 0.035)
    .fill({ color: 0x35241c });
  graphics
    .ellipse(x + scale * 0.57, y + scale * 0.03, scale * 0.11, scale * 0.065)
    .fill({ color: 0xffefdd, alpha: 0.94 - pulse * 0.14 });
  graphics
    .circle(x + scale * 0.57, y + scale * 0.02, scale * 0.018)
    .fill({ color: 0xffa98a, alpha: 0.95 });
}

function drawSleepingCat(
  graphics: Graphics,
  x: number,
  y: number,
  scale: number,
  breathe: number,
) {
  graphics
    .ellipse(x, y + scale * 0.32, scale * 1.1, scale * 0.24)
    .fill({ color: 0x25150d, alpha: 0.16 });

  graphics
    .ellipse(x - scale * 0.08, y, scale * 0.88, scale * (0.5 + breathe * 0.04))
    .fill({ color: 0xf6c78d });
  graphics
    .circle(x + scale * 0.7, y - scale * 0.1, scale * 0.26)
    .fill({ color: 0xf6c78d });
  graphics
    .circle(x + scale * 0.58, y - scale * 0.28, scale * 0.1)
    .fill({ color: 0xffddb5 });
  graphics
    .circle(x + scale * 0.82, y - scale * 0.3, scale * 0.1)
    .fill({ color: 0xffddb5 });
  graphics
    .ellipse(x - scale * 0.18, y + scale * 0.18, scale * 0.24, scale * 0.12)
    .fill({ color: 0xffe8c8, alpha: 0.34 });
  graphics
    .ellipse(x - scale * 0.82, y + scale * 0.04, scale * 0.34, scale * 0.14)
    .fill({ color: 0xf6c78d });
}

function drawWindow(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  unit: number,
  pulse: number,
) {
  graphics
    .roundRect(x, y + unit * 0.008, width, height, 34)
    .fill({ color: 0x08131f, alpha: 0.42 });
  graphics
    .roundRect(x, y, width, height, 34)
    .fill({ color: 0x10263c })
    .stroke({ color: 0x3d6d92, alpha: 0.55, width: 4 });
  graphics
    .roundRect(
      x + unit * 0.02,
      y + unit * 0.02,
      width - unit * 0.04,
      height - unit * 0.04,
      28,
    )
    .fill({ color: 0x081424 });
  graphics
    .circle(x + width * 0.76, y + height * 0.24, unit * 0.048)
    .fill({ color: 0xffdf97, alpha: 0.18 + pulse * 0.08 });
  graphics
    .circle(x + width * 0.76, y + height * 0.24, unit * 0.028)
    .fill({ color: 0xffebb6, alpha: 0.98 });
  graphics
    .circle(x + width * 0.24, y + height * 0.18, unit * 0.006)
    .fill({ color: 0xd6ecff, alpha: 0.82 });
  graphics
    .circle(x + width * 0.38, y + height * 0.28, unit * 0.004)
    .fill({ color: 0xd6ecff, alpha: 0.72 });
  graphics
    .circle(x + width * 0.66, y + height * 0.16, unit * 0.0045)
    .fill({ color: 0xd6ecff, alpha: 0.78 });
  graphics
    .rect(x + width * 0.32, y + height * 0.09, width * 0.04, height * 0.82)
    .fill({ color: 0x274a69 });
  graphics
    .rect(x + width * 0.63, y + height * 0.09, width * 0.04, height * 0.82)
    .fill({ color: 0x274a69 });
  graphics
    .roundRect(
      x + width * 0.12,
      y + height * 0.82,
      width * 0.76,
      unit * 0.024,
      10,
    )
    .fill({ color: 0x17314a, alpha: 0.88 });
}

function drawBoard(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  unit: number,
) {
  graphics
    .roundRect(x, y + unit * 0.006, width, height, 26)
    .fill({ color: 0x261810, alpha: 0.16 });
  graphics
    .roundRect(x, y, width, height, 26)
    .fill({ color: 0xe7dcc7, alpha: 0.96 })
    .stroke({ color: 0x8f7348, alpha: 0.45, width: 3 });
  graphics
    .roundRect(
      x + width * 0.08,
      y + height * 0.18,
      width * 0.17,
      height * 0.28,
      10,
    )
    .fill({ color: 0xf4c777, alpha: 0.94 });
  graphics
    .roundRect(
      x + width * 0.32,
      y + height * 0.16,
      width * 0.24,
      height * 0.24,
      10,
    )
    .fill({ color: 0xa7d9d0, alpha: 0.92 });
  graphics
    .roundRect(
      x + width * 0.62,
      y + height * 0.24,
      width * 0.18,
      height * 0.24,
      10,
    )
    .fill({ color: 0xf1b2a4, alpha: 0.92 });
  graphics
    .circle(x + width * 0.165, y + height * 0.14, unit * 0.005)
    .fill({ color: 0x6f5435, alpha: 0.88 });
  graphics
    .circle(x + width * 0.44, y + height * 0.12, unit * 0.005)
    .fill({ color: 0x6f5435, alpha: 0.88 });
  graphics
    .circle(x + width * 0.71, y + height * 0.2, unit * 0.005)
    .fill({ color: 0x6f5435, alpha: 0.88 });
  graphics
    .roundRect(
      x + width * 0.2,
      y + height * 0.76,
      width * 0.44,
      unit * 0.016,
      8,
    )
    .fill({ color: 0x7e6440, alpha: 0.8 });
  graphics
    .rect(x + width * 0.26, y + height * 0.67, width * 0.03, height * 0.09)
    .fill({ color: 0xa37a42 });
  graphics
    .rect(x + width * 0.32, y + height * 0.62, width * 0.03, height * 0.14)
    .fill({ color: 0x6fa0c7 });
  graphics
    .rect(x + width * 0.38, y + height * 0.66, width * 0.03, height * 0.1)
    .fill({ color: 0xd46c62 });
}

function drawCabinet(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  unit: number,
) {
  graphics
    .roundRect(x, y + unit * 0.006, width, height, 24)
    .fill({ color: 0x09131f, alpha: 0.22 });
  graphics
    .roundRect(x, y, width, height, 24)
    .fill({ color: 0x17283b, alpha: 0.98 })
    .stroke({ color: 0x446f93, alpha: 0.58, width: 3 });
  graphics
    .roundRect(
      x + unit * 0.018,
      y + unit * 0.02,
      width - unit * 0.036,
      height - unit * 0.04,
      18,
    )
    .fill({ color: 0x21354c, alpha: 0.92 });
  graphics
    .rect(x + width * 0.2, y + height * 0.34, width * 0.6, unit * 0.006)
    .fill({ color: 0x4f7593, alpha: 0.62 });
  graphics
    .rect(x + width * 0.3, y + height * 0.54, width * 0.44, unit * 0.006)
    .fill({ color: 0x4f7593, alpha: 0.56 });
  graphics
    .rect(x + width * 0.26, y + height * 0.17, width * 0.12, height * 0.15)
    .fill({ color: 0x8f5d45, alpha: 0.92 });
  graphics
    .rect(x + width * 0.41, y + height * 0.15, width * 0.12, height * 0.17)
    .fill({ color: 0x6c8fb1, alpha: 0.92 });
  graphics
    .rect(x + width * 0.58, y + height * 0.18, width * 0.08, height * 0.14)
    .fill({ color: 0xd5b574, alpha: 0.92 });
  graphics
    .circle(x + width * 0.39, y + height * 0.44, unit * 0.01)
    .fill({ color: 0xc9dbef, alpha: 0.9 });
  graphics
    .circle(x + width * 0.56, y + height * 0.44, unit * 0.01)
    .fill({ color: 0xc9dbef, alpha: 0.9 });
  graphics
    .circle(x + width * 0.47, y + height * 0.63, unit * 0.008)
    .fill({ color: 0xfff0ca, alpha: 0.72 });
}

function drawDesk(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  unit: number,
  pulse: number,
) {
  graphics
    .ellipse(x + width * 0.48, y + height * 0.88, width * 0.52, unit * 0.05)
    .fill({ color: 0x050b11, alpha: 0.32 });
  graphics
    .circle(x + width * 0.48, y - height * 0.32, unit * 0.08)
    .fill({ color: 0x52c8ff, alpha: 0.1 + pulse * 0.03 });
  graphics
    .roundRect(
      x + width * 0.23,
      y - height * 0.46,
      width * 0.33,
      height * 0.3,
      18,
    )
    .fill({ color: 0x102437 })
    .stroke({ color: 0x63b7e4, alpha: 0.78, width: 3 });
  graphics
    .roundRect(
      x + width * 0.27,
      y - height * 0.42,
      width * 0.25,
      height * 0.2,
      14,
    )
    .fill({ color: 0x3d789c, alpha: 0.92 });
  graphics
    .circle(x + width * 0.5, y - height * 0.2, unit * 0.005)
    .fill({ color: 0x9ce2ff, alpha: 0.9 });
  graphics
    .rect(x + width * 0.39, y - height * 0.16, width * 0.02, height * 0.08)
    .fill({ color: 0x81562f });
  graphics
    .roundRect(
      x + width * 0.24,
      y + height * 0.03,
      width * 0.14,
      unit * 0.018,
      8,
    )
    .fill({ color: 0x22384d, alpha: 0.88 });
  graphics
    .circle(x + width * 0.72, y - height * 0.16, unit * 0.016)
    .fill({ color: 0xffb05d, alpha: 0.86 });
  graphics
    .circle(x + width * 0.72, y - height * 0.16, unit * 0.05)
    .fill({ color: 0xffa452, alpha: 0.12 });
  graphics
    .rect(x + width * 0.69, y - height * 0.1, unit * 0.008, unit * 0.06)
    .fill({ color: 0xb27038 });
  graphics
    .roundRect(x, y, width, height * 0.16, 20)
    .fill({ color: 0x8d633a, alpha: 0.98 });
  graphics
    .roundRect(
      x + width * 0.05,
      y + height * 0.03,
      width * 0.9,
      height * 0.06,
      14,
    )
    .fill({ color: 0xa07447, alpha: 0.4 });
  graphics
    .rect(x + width * 0.12, y + height * 0.16, unit * 0.022, height * 0.56)
    .fill({ color: 0x694120 });
  graphics
    .rect(x + width * 0.82, y + height * 0.16, unit * 0.022, height * 0.56)
    .fill({ color: 0x694120 });
}

export function drawScene(
  graphics: Graphics,
  width: number,
  height: number,
  time: number,
) {
  const unit = Math.min(width, height);
  const floorY = height * 0.72;
  const pulse = (Math.sin(time * 1.7) + 1) / 2;
  const breathe = (Math.sin(time * 1.35) + 1) / 2;
  const bubbleLift = (Math.sin(time * 2.1) + 1) * unit * 0.01;
  const windowX = width * 0.08;
  const windowY = height * 0.1;
  const windowWidth = width * 0.22;
  const windowHeight = height * 0.29;
  const boardX = width * 0.37;
  const boardY = height * 0.16;
  const boardWidth = width * 0.18;
  const boardHeight = height * 0.14;
  const cabinetX = width * 0.69;
  const cabinetY = height * 0.16;
  const cabinetWidth = width * 0.12;
  const cabinetHeight = height * 0.2;
  const deskX = width * 0.64;
  const deskY = floorY - unit * 0.04;
  const deskWidth = width * 0.2;
  const deskHeight = unit * 0.22;

  graphics.clear();

  graphics.rect(0, 0, width, height).fill({ color: 0x06111b });
  graphics
    .rect(0, height * 0.11, width, height * 0.54)
    .fill({ color: 0x0a1521, alpha: 0.18 });
  graphics
    .circle(width * 0.17, height * 0.14, unit * 0.22)
    .fill({ color: 0x123d67, alpha: 0.22 });
  graphics
    .circle(width * 0.53, height * 0.1, unit * 0.18)
    .fill({ color: 0xff9d5d, alpha: 0.1 });
  graphics
    .circle(width * 0.82, height * 0.16, unit * 0.24)
    .fill({ color: 0x43275e, alpha: 0.16 });
  graphics
    .circle(width * 0.36, height * 0.22, unit * 0.006)
    .fill({ color: 0xabcce4, alpha: 0.52 });
  graphics
    .circle(width * 0.61, height * 0.18, unit * 0.005)
    .fill({ color: 0xe0be94, alpha: 0.64 });
  graphics
    .circle(width * 0.72, height * 0.23, unit * 0.0055)
    .fill({ color: 0x73c7f1, alpha: 0.7 });

  drawWindow(
    graphics,
    windowX,
    windowY,
    windowWidth,
    windowHeight,
    unit,
    pulse,
  );
  drawBoard(graphics, boardX, boardY, boardWidth, boardHeight, unit);
  drawCabinet(graphics, cabinetX, cabinetY, cabinetWidth, cabinetHeight, unit);

  graphics
    .rect(0, floorY, width, height - floorY)
    .fill({ color: 0x122132, alpha: 0.98 });
  graphics
    .rect(0, floorY + unit * 0.018, width, unit * 0.006)
    .fill({ color: 0x31516b, alpha: 0.52 });
  graphics
    .rect(0, floorY - unit * 0.012, width, unit * 0.008)
    .fill({ color: 0x233649, alpha: 0.78 });
  for (const offset of [0.16, 0.34, 0.52, 0.7, 0.88]) {
    graphics
      .rect(
        width * offset,
        floorY + unit * 0.024,
        unit * 0.004,
        height - floorY,
      )
      .fill({ color: 0x29425a, alpha: 0.22 });
  }
  graphics
    .ellipse(width * 0.52, floorY + unit * 0.11, unit * 0.3, unit * 0.09)
    .fill({ color: 0x173149, alpha: 0.96 })
    .stroke({ color: 0x365f84, alpha: 0.5, width: 3 });
  graphics
    .ellipse(width * 0.52, floorY + unit * 0.11, unit * 0.24, unit * 0.066)
    .fill({ color: 0x1d3b56, alpha: 0.5 });

  drawDesk(graphics, deskX, deskY, deskWidth, deskHeight, unit, pulse);

  graphics
    .ellipse(width * 0.2, floorY + unit * 0.03, unit * 0.165, unit * 0.062)
    .fill({ color: 0xc26d42, alpha: 0.96 });
  graphics
    .ellipse(width * 0.2, floorY + unit * 0.03, unit * 0.125, unit * 0.044)
    .fill({ color: 0xf2b56f, alpha: 0.86 });
  graphics
    .ellipse(width * 0.2, floorY + unit * 0.016, unit * 0.085, unit * 0.03)
    .fill({ color: 0xffcf85, alpha: 0.72 });
  graphics
    .ellipse(width * 0.16, floorY + unit * 0.02, unit * 0.028, unit * 0.014)
    .fill({ color: 0xffdcb3, alpha: 0.78 });
  graphics
    .ellipse(width * 0.24, floorY + unit * 0.02, unit * 0.028, unit * 0.014)
    .fill({ color: 0xffdcb3, alpha: 0.78 });

  graphics
    .roundRect(width * 0.57, height * 0.14, width * 0.08, unit * 0.02, 10)
    .fill({ color: 0x7a6041, alpha: 0.82 });
  graphics
    .rect(width * 0.585, height * 0.095, width * 0.012, height * 0.045)
    .fill({ color: 0xb27a3e, alpha: 0.92 });
  graphics
    .rect(width * 0.605, height * 0.087, width * 0.012, height * 0.053)
    .fill({ color: 0x6f94b8, alpha: 0.92 });
  graphics
    .rect(width * 0.625, height * 0.1, width * 0.012, height * 0.04)
    .fill({ color: 0xd9bc7c, alpha: 0.92 });

  drawWorkingCat(
    graphics,
    width * 0.755,
    floorY - unit * 0.005,
    unit * 0.088,
    pulse,
  );
  drawSleepingCat(
    graphics,
    width * 0.2,
    floorY + unit * 0.008,
    unit * 0.078,
    breathe,
  );

  graphics
    .circle(width * 0.29, floorY - unit * 0.09 - bubbleLift, unit * 0.011)
    .fill({ color: 0xd8f5ff, alpha: 0.4 });
  graphics
    .circle(width * 0.31, floorY - unit * 0.13 - bubbleLift * 1.4, unit * 0.007)
    .fill({ color: 0xd8f5ff, alpha: 0.28 });
  graphics
    .circle(
      width * 0.325,
      floorY - unit * 0.165 - bubbleLift * 1.7,
      unit * 0.0045,
    )
    .fill({ color: 0xd8f5ff, alpha: 0.22 });
}
