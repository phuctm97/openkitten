import { expect, test } from "vitest";
import { houseCats } from "~/lib/house-cats";

test("defines two readable cat fixtures for the first house slice", () => {
  expect(houseCats).toHaveLength(2);
  expect(houseCats.map(({ cat }) => cat.id)).toEqual(["cat-a", "cat-b"]);
  expect(houseCats.map(({ cat }) => cat.name)).toEqual(["Mochi", "Juniper"]);
  expect(houseCats.map(({ cat }) => cat.state)).toEqual(["awake", "resting"]);
  expect(houseCats.map(({ textureKey }) => textureKey)).toEqual([
    "cat-a-awake-v1",
    "cat-b-resting-v1",
  ]);
  expect(houseCats.map(({ position }) => position)).toEqual([
    { x: 560, y: 620 },
    { x: 332, y: 768 },
  ]);
  expect(
    houseCats.every(({ floorHeight, floorWidth, floorY, spriteSize }) => {
      return (
        floorHeight > 0 &&
        floorWidth > 0 &&
        floorY > 0 &&
        spriteSize > floorWidth
      );
    }),
  ).toBe(true);
});
