import { afterEach, expect, test, vi } from "vitest";
import awakeCatTexturePath from "~/assets/cat-a-awake-v1.webp";
import restingCatTexturePath from "~/assets/cat-b-resting-v1.webp";
import roomShellTexturePath from "~/assets/house-room-shell-v1.webp";

class MockMutationObserver {
  static readonly instances: MockMutationObserver[] = [];
  readonly disconnect = vi.fn();
  readonly observe = vi.fn();
  constructor(private readonly callback: () => void) {
    MockMutationObserver.instances.push(this);
  }
  notify() {
    this.callback();
  }
}

function createMockCamera() {
  const camera = {
    setBackgroundColor: vi.fn(),
    setSize: vi.fn(),
    setViewport: vi.fn(),
  };
  return camera;
}

function createChainable() {
  const obj = {
    setOrigin: vi.fn(),
    setDepth: vi.fn(),
    setDisplaySize: vi.fn(),
    setPosition: vi.fn(),
    setFillStyle: vi.fn(),
  };
  for (const key of Object.keys(obj) as (keyof typeof obj)[]) {
    obj[key].mockReturnValue(obj);
  }
  return obj;
}

const mocks = vi.hoisted(() => {
  const cameras: ReturnType<typeof createMockCamera>[] = [];
  const images: ReturnType<typeof createChainable>[] = [];
  const rectangles: ReturnType<typeof createChainable>[] = [];
  const tweens: { add: ReturnType<typeof vi.fn> }[] = [];
  const inputs: { enabled: boolean }[] = [];
  const events: { once: ReturnType<typeof vi.fn> }[] = [];
  const scales: {
    width: number;
    height: number;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  }[] = [];
  const canvases: {
    style: { backgroundColor: string; touchAction: string };
  }[] = [];
  const loaders: { image: ReturnType<typeof vi.fn> }[] = [];

  class MockScene {
    cameras = { main: createMockCamera() };
    add = {
      image: vi.fn(() => {
        const image = createChainable();
        images.push(image);
        return image;
      }),
      rectangle: vi.fn(() => {
        const rect = createChainable();
        rectangles.push(rect);
        return rect;
      }),
    };
    tweens = { add: vi.fn() };
    input: { enabled: boolean } = { enabled: true };
    events = { once: vi.fn() };
    game = {
      canvas: { style: { backgroundColor: "", touchAction: "" } },
    };
    scale: {
      width: number;
      height: number;
      on: ReturnType<typeof vi.fn>;
      off: ReturnType<typeof vi.fn>;
    } = {
      width: 1280,
      height: 720,
      on: vi.fn(),
      off: vi.fn(),
    };
    load = { image: vi.fn() };

    constructor(_key?: unknown) {
      cameras.push(this.cameras.main);
      tweens.push(this.tweens);
      inputs.push(this.input);
      events.push(this.events);
      canvases.push(this.game.canvas);
      scales.push(this.scale);
      loaders.push(this.load);
    }
  }

  return {
    cameras,
    images,
    rectangles,
    tweens,
    inputs,
    events,
    canvases,
    scales,
    loaders,
    MockScene,
  };
});

vi.mock("phaser", () => ({
  GameObjects: { Image: class {}, Rectangle: class {} },
  Math: { Easing: { Sine: { InOut: "ease-sine" } } },
  Scale: { Events: { RESIZE: "resize-event" } },
  Scene: mocks.MockScene,
  Scenes: { Events: { SHUTDOWN: "shutdown-event" } },
}));

afterEach(() => {
  mocks.cameras.length = 0;
  mocks.images.length = 0;
  mocks.rectangles.length = 0;
  mocks.tweens.length = 0;
  mocks.inputs.length = 0;
  mocks.events.length = 0;
  mocks.canvases.length = 0;
  mocks.scales.length = 0;
  mocks.loaders.length = 0;
  MockMutationObserver.instances.length = 0;
  document.documentElement.style.colorScheme = "";
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("preloads room and cat textures", async () => {
  const { AmbientHouseScene } = await import("~/lib/ambient-house-scene");
  const scene = new AmbientHouseScene();
  scene.preload();
  const loader = mocks.loaders[0];
  expect(loader?.image).toHaveBeenCalledWith(
    "ambient-room-shell",
    roomShellTexturePath,
  );
  expect(loader?.image).toHaveBeenCalledWith(
    "ambient-cat-a-awake",
    awakeCatTexturePath,
  );
  expect(loader?.image).toHaveBeenCalledWith(
    "ambient-cat-b-resting",
    restingCatTexturePath,
  );
});

test("create assembles the scene, disables input, and registers tweens", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);
  const { AmbientHouseScene } = await import("~/lib/ambient-house-scene");
  const scene = new AmbientHouseScene();
  scene.preload();
  scene.create();

  const tween = mocks.tweens[0];
  const input = mocks.inputs[0];
  const canvas = mocks.canvases[0];
  const scale = mocks.scales[0];
  const events = mocks.events[0];

  expect(input?.enabled).toBe(false);
  expect(canvas?.style.touchAction).toBe("none");
  expect(tween?.add).toHaveBeenCalledTimes(2);
  expect(scale?.on).toHaveBeenCalledWith(
    "resize-event",
    expect.any(Function),
    scene,
  );
  expect(events?.once).toHaveBeenCalledWith(
    "shutdown-event",
    expect.any(Function),
    scene,
  );
  expect(MockMutationObserver.instances).toHaveLength(1);
});

test("layout repositions on resize and uses dark palette when colorScheme is dark", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);
  document.documentElement.style.colorScheme = "dark";
  const { AmbientHouseScene } = await import("~/lib/ambient-house-scene");
  const scene = new AmbientHouseScene();
  scene.preload();
  scene.create();

  const camera = mocks.cameras[0];
  const scale = mocks.scales[0];
  const resizeHandler = scale?.on.mock.calls[0]?.[1];

  expect(camera?.setBackgroundColor).toHaveBeenCalledWith("#09090b");
  expect(resizeHandler).toBeDefined();
  if (scale === undefined || typeof resizeHandler !== "function") return;

  scale.width = 800;
  scale.height = 400;
  resizeHandler.call(scene);

  expect(camera?.setSize).toHaveBeenLastCalledWith(800, 400);
});

test("syncPalette responds to documentElement style mutations", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);
  const { AmbientHouseScene } = await import("~/lib/ambient-house-scene");
  const scene = new AmbientHouseScene();
  scene.preload();
  scene.create();

  const observer = MockMutationObserver.instances[0];
  const camera = mocks.cameras[0];
  if (camera === undefined) {
    throw new Error("camera mock missing");
  }
  camera.setBackgroundColor.mockClear();

  document.documentElement.style.colorScheme = "dark";
  observer?.notify();

  expect(camera.setBackgroundColor).toHaveBeenCalledWith("#09090b");
});

test("shutdown disconnects the observer and removes the resize handler", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);
  const { AmbientHouseScene } = await import("~/lib/ambient-house-scene");
  const scene = new AmbientHouseScene();
  scene.preload();
  scene.create();

  const events = mocks.events[0];
  const scale = mocks.scales[0];
  const camera = mocks.cameras[0];
  const observer = MockMutationObserver.instances[0];
  const shutdownHandler = events?.once.mock.calls[0]?.[1];
  const resizeHandler = scale?.on.mock.calls[0]?.[1];

  if (
    typeof shutdownHandler !== "function" ||
    typeof resizeHandler !== "function" ||
    camera === undefined
  ) {
    throw new Error("Expected handlers to be registered");
  }

  shutdownHandler.call(scene);
  expect(observer?.disconnect).toHaveBeenCalledTimes(1);
  expect(scale?.off).toHaveBeenCalledWith(
    "resize-event",
    expect.any(Function),
    scene,
  );

  camera.setBackgroundColor.mockClear();
  observer?.notify();
  expect(() => {
    resizeHandler.call(scene);
  }).not.toThrow();
  expect(camera.setBackgroundColor).not.toHaveBeenCalled();
});
