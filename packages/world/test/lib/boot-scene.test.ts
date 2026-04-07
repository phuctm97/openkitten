import { afterEach, expect, test, vi } from "vitest";

const bootSceneMocks = vi.hoisted(() => {
  const keys: unknown[] = [];
  const starts: unknown[] = [];

  class MockScene {
    scene = {
      start: vi.fn((key: unknown) => {
        starts.push(key);
      }),
    };

    constructor(key?: unknown) {
      keys.push(key);
    }
  }

  return {
    keys,
    MockScene,
    starts,
  };
});

vi.mock("phaser", () => ({
  default: {
    Scene: bootSceneMocks.MockScene,
  },
}));

afterEach(() => {
  bootSceneMocks.keys.length = 0;
  bootSceneMocks.starts.length = 0;
  vi.clearAllMocks();
  vi.resetModules();
});

test("starts the house scene after booting", async () => {
  const { BootScene } = await import("~/lib/boot-scene");
  const { HouseScene } = await import("~/lib/house-scene");
  const scene = new BootScene();

  expect(BootScene.key).toBe("boot");
  expect(bootSceneMocks.keys[0]).toBe(BootScene.key);

  scene.create();

  expect(scene.scene.start).toHaveBeenCalledWith(HouseScene.key);
  expect(bootSceneMocks.starts).toEqual([HouseScene.key]);
});
