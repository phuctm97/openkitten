import { afterEach, expect, test, vi } from "vitest";

const phaserMocks = vi.hoisted(() => ({
  game: vi.fn(),
}));

vi.mock("phaser", () => ({
  default: {
    Game: phaserMocks.game,
    Scene: class Scene {},
    Scale: {
      RESIZE: "RESIZE",
    },
  },
}));

afterEach(() => {
  document.documentElement.style.colorScheme = "";
  vi.clearAllMocks();
  vi.resetModules();
});

test("creates a fullscreen Phaser game bound to the provided parent", async () => {
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
    scene: [expect.any(Function), expect.any(Function)],
  });
});
