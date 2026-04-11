import { afterEach, expect, test, vi } from "vitest";

const phaserMocks = vi.hoisted(() => ({
  game: vi.fn(),
}));

vi.mock("phaser", () => ({
  Game: phaserMocks.game,
  Scene: class Scene {},
  Scale: {
    RESIZE: "RESIZE",
  },
}));

afterEach(() => {
  document.documentElement.style.colorScheme = "";
  vi.clearAllMocks();
  vi.resetModules();
  vi.restoreAllMocks();
});

test("creates a fullscreen Phaser game bound to the provided parent", async () => {
  const { HouseScene } = await import("~/lib/house-scene");
  const { createGame } = await import("~/lib/create-game");
  const parent = document.createElement("div");

  document.documentElement.style.colorScheme = "dark";
  createGame(parent);

  expect(phaserMocks.game).toHaveBeenCalledTimes(1);
  expect(phaserMocks.game).toHaveBeenCalledWith({
    parent,
    backgroundColor: "#0c0a09",
    roundPixels: true,
    scale: { mode: "RESIZE" },
    scene: [HouseScene],
  });
});

test("uses the computed document color scheme when inline style is unset", async () => {
  const { HouseScene } = await import("~/lib/house-scene");
  const { createGame } = await import("~/lib/create-game");
  const parent = document.createElement("div");

  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    colorScheme: "dark",
  } as never);

  createGame(parent);

  expect(phaserMocks.game).toHaveBeenCalledWith({
    parent,
    backgroundColor: "#0c0a09",
    roundPixels: true,
    scale: { mode: "RESIZE" },
    scene: [HouseScene],
  });
});
