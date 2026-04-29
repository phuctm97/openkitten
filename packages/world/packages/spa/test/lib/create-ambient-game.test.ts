import { afterEach, expect, test, vi } from "vitest";

const phaserMock = vi.hoisted(() => ({
  Game: vi.fn(),
  Scale: { RESIZE: "resize-mode" },
}));

vi.mock("phaser", () => ({
  Game: phaserMock.Game,
  Scale: phaserMock.Scale,
}));

vi.mock("~/lib/ambient-house-scene", () => ({
  AmbientHouseScene: class AmbientScene {},
}));

vi.mock("~/lib/get-color-scheme", () => ({
  getColorScheme: () => "light",
}));

vi.mock("~/lib/get-house-palette", () => ({
  getHousePalette: () => ({
    backgroundColor: "#ffffff",
    ambientShadowAlpha: 0,
    ambientShadowColor: 0,
  }),
}));

afterEach(() => {
  phaserMock.Game.mockReset();
});

test("constructs a Phaser game with no input or audio so it stays passive", async () => {
  const { createAmbientGame } = await import("~/lib/create-ambient-game");
  const parent = document.createElement("div");
  createAmbientGame(parent);
  expect(phaserMock.Game).toHaveBeenCalledTimes(1);
  const config = phaserMock.Game.mock.calls[0]?.[0];
  expect(config?.parent).toBe(parent);
  expect(config?.backgroundColor).toBe("#ffffff");
  expect(config?.input).toStrictEqual({
    keyboard: false,
    mouse: false,
    touch: false,
  });
  expect(config?.audio).toStrictEqual({ noAudio: true });
});
