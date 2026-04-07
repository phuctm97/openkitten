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
  vi.clearAllMocks();
  vi.resetModules();
});

test("creates a fullscreen Phaser game bound to the provided parent", async () => {
  const { createGame } = await import("~/lib/create-game");
  const parent = document.createElement("div");

  createGame(parent);

  expect(phaserMocks.game).toHaveBeenCalledTimes(1);
  expect(phaserMocks.game).toHaveBeenCalledWith({
    parent,
    scale: {
      mode: "RESIZE",
    },
    scene: [expect.any(Function), expect.any(Function)],
  });
});
