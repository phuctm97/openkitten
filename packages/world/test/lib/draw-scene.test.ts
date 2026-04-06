import type { FillInput, StrokeInput } from "pixi.js";
import { expect, test } from "vitest";
import { drawScene } from "~/lib/draw-scene";

class GraphicsRecorder {
  calls: Array<{
    args: unknown[];
    method: string;
  }> = [];

  circle(x: number, y: number, radius: number) {
    this.calls.push({ args: [x, y, radius], method: "circle" });

    return this;
  }

  clear() {
    this.calls.push({ args: [], method: "clear" });

    return this;
  }

  ellipse(x: number, y: number, halfWidth: number, halfHeight: number) {
    this.calls.push({
      args: [x, y, halfWidth, halfHeight],
      method: "ellipse",
    });

    return this;
  }

  fill(style?: FillInput) {
    this.calls.push({
      args: style === undefined ? [] : [style],
      method: "fill",
    });

    return this;
  }

  rect(x: number, y: number, width: number, height: number) {
    this.calls.push({ args: [x, y, width, height], method: "rect" });

    return this;
  }

  roundRect(x: number, y: number, width: number, height: number, radius = 0) {
    this.calls.push({
      args: [x, y, width, height, radius],
      method: "roundRect",
    });

    return this;
  }

  stroke(style?: StrokeInput) {
    this.calls.push({ args: [style], method: "stroke" });

    return this;
  }
}

function hasNumericCall(
  calls: GraphicsRecorder["calls"],
  method: string,
  expectedArgs: number[],
) {
  return calls.some((call) => {
    return (
      call.method === method &&
      call.args.length === expectedArgs.length &&
      call.args.every((value, index) => {
        const expectedValue = expectedArgs[index];

        return (
          expectedValue !== undefined &&
          typeof value === "number" &&
          Math.abs(value - expectedValue) < 0.001
        );
      })
    );
  });
}

test("draws the room shell, props, and both cats", () => {
  const graphics = new GraphicsRecorder();

  drawScene(graphics as never, 1280, 800, 1.25);

  expect(graphics.calls[0]).toEqual({ args: [], method: "clear" });
  expect(hasNumericCall(graphics.calls, "rect", [0, 0, 1280, 800])).toBe(true);
  expect(
    hasNumericCall(graphics.calls, "roundRect", [102.4, 80, 281.6, 232, 34]),
  ).toBe(true);
  expect(
    hasNumericCall(graphics.calls, "roundRect", [473.6, 128, 230.4, 112, 26]),
  ).toBe(true);
  expect(
    hasNumericCall(graphics.calls, "roundRect", [883.2, 128, 153.6, 160, 24]),
  ).toBe(true);
  expect(hasNumericCall(graphics.calls, "ellipse", [665.6, 664, 240, 72])).toBe(
    true,
  );
  expect(
    graphics.calls.filter(({ method }) => method === "circle").length,
  ).toBeGreaterThanOrEqual(22);
  expect(
    graphics.calls.filter(({ method }) => method === "stroke").length,
  ).toBeGreaterThanOrEqual(5);
});
