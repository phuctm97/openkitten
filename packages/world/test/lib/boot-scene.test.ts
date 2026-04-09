import { afterEach, expect, test, vi } from "vitest";

const bootSceneMocks = vi.hoisted(() => {
  const keys: unknown[] = [];
  const loads: Array<{ key: unknown; path: unknown }> = [];
  const starts: unknown[] = [];

  class MockScene {
    load = {
      image: vi.fn((key: unknown, path: unknown) => {
        loads.push({ key, path });
      }),
    };
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
    loads,
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
  bootSceneMocks.loads.length = 0;
  bootSceneMocks.starts.length = 0;
  vi.clearAllMocks();
  vi.resetModules();
});

test("preloads the curated world asset pack before starting the house scene", async () => {
  const { BootScene } = await import("~/lib/boot-scene");
  const { HouseScene } = await import("~/lib/house-scene");
  const { worldAssets } = await import("~/lib/world-assets");
  const scene = new BootScene();

  expect(BootScene.key).toBe("boot");
  expect(bootSceneMocks.keys[0]).toBe(BootScene.key);

  scene.preload();
  scene.create();

  expect(scene.load.image).toHaveBeenCalledTimes(
    worldAssets.preloadEntries.length,
  );
  expect(bootSceneMocks.loads).toEqual([...worldAssets.preloadEntries]);
  expect(scene.scene.start).toHaveBeenCalledWith(HouseScene.key);
  expect(bootSceneMocks.starts).toEqual([HouseScene.key]);
});
