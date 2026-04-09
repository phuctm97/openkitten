import { afterEach, expect, test, vi } from "vitest";

type MockCamera = {
  setBackgroundColor: ReturnType<typeof vi.fn>;
};

type MockCanvas = {
  style: {
    backgroundColor: string;
  };
};

type MockEventEmitter = {
  once: ReturnType<typeof vi.fn>;
};

type MockImage = {
  setDisplaySize: ReturnType<typeof vi.fn>;
  setOrigin: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
};

type MockLoader = {
  image: ReturnType<typeof vi.fn>;
};

type MockRenderer = {
  config: {
    backgroundColor: unknown;
  };
};

type MockScale = {
  height: number;
  off: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  width: number;
};

type MockShape = {
  setDisplaySize: ReturnType<typeof vi.fn>;
  setFillStyle: ReturnType<typeof vi.fn>;
  setOrigin: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
};

class MockMutationObserver {
  static readonly instances: MockMutationObserver[] = [];

  readonly disconnect = vi.fn();
  readonly observe = vi.fn();

  constructor(private readonly callback: (...args: unknown[]) => void) {
    MockMutationObserver.instances.push(this);
  }

  notify() {
    this.callback();
  }
}

function createMockCamera(): MockCamera {
  const camera = {
    setBackgroundColor: vi.fn(),
  };

  camera.setBackgroundColor.mockReturnValue(camera);

  return camera;
}

function createMockCanvas(): MockCanvas {
  return {
    style: {
      backgroundColor: "",
    },
  };
}

function createMockEventEmitter(): MockEventEmitter {
  return {
    once: vi.fn(),
  };
}

function createMockImage(): MockImage {
  const image = {
    setDisplaySize: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
  };

  image.setDisplaySize.mockReturnValue(image);
  image.setOrigin.mockReturnValue(image);
  image.setPosition.mockReturnValue(image);

  return image;
}

function createMockLoader(): MockLoader {
  return {
    image: vi.fn(),
  };
}

function createMockRenderer(): MockRenderer {
  return {
    config: {
      backgroundColor: null,
    },
  };
}

function createMockScale(): MockScale {
  return {
    height: 720,
    off: vi.fn(),
    on: vi.fn(),
    width: 1280,
  };
}

function createMockShape(): MockShape {
  const shape = {
    setDisplaySize: vi.fn(),
    setFillStyle: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
  };

  shape.setDisplaySize.mockReturnValue(shape);
  shape.setFillStyle.mockReturnValue(shape);
  shape.setOrigin.mockReturnValue(shape);
  shape.setPosition.mockReturnValue(shape);

  return shape;
}

const houseSceneMocks = vi.hoisted(() => {
  const cameras: MockCamera[] = [];
  const canvases: MockCanvas[] = [];
  const events: MockEventEmitter[] = [];
  const images: MockImage[] = [];
  const keys: unknown[] = [];
  const loaders: MockLoader[] = [];
  const rectangles: MockShape[] = [];
  const renderers: MockRenderer[] = [];
  const scales: MockScale[] = [];

  class MockScene {
    add = {
      image: vi.fn((_x: number, _y: number, _key: string) => {
        const image = createMockImage();
        images.push(image);
        return image;
      }),
      rectangle: vi.fn(
        (
          _x: number,
          _y: number,
          _width: number,
          _height: number,
          _color: number,
          _alpha?: number,
        ) => {
          const rectangle = createMockShape();
          rectangles.push(rectangle);
          return rectangle;
        },
      ),
    };
    cameras = {
      main: createMockCamera(),
    };
    events = createMockEventEmitter();
    game = {
      canvas: createMockCanvas(),
      renderer: createMockRenderer(),
    };
    load = createMockLoader();
    scale = createMockScale();

    constructor(key?: unknown) {
      keys.push(key);
      cameras.push(this.cameras.main);
      canvases.push(this.game.canvas);
      events.push(this.events);
      loaders.push(this.load);
      renderers.push(this.game.renderer);
      scales.push(this.scale);
    }
  }

  return {
    cameras,
    canvases,
    events,
    images,
    keys,
    loaders,
    MockScene,
    rectangles,
    renderers,
    scales,
  };
});

vi.mock("phaser", () => ({
  default: {
    Display: {
      Color: {
        ValueToColor: vi.fn((color: string) => `converted:${color}`),
      },
    },
    GameObjects: {
      Image: class Image {},
      Rectangle: class Rectangle {},
    },
    Scale: {
      Events: {
        RESIZE: "resize-event",
      },
    },
    Scene: houseSceneMocks.MockScene,
    Scenes: {
      Events: {
        SHUTDOWN: "shutdown-event",
      },
    },
  },
}));

afterEach(() => {
  document.documentElement.style.colorScheme = "";
  houseSceneMocks.cameras.length = 0;
  houseSceneMocks.canvases.length = 0;
  houseSceneMocks.events.length = 0;
  houseSceneMocks.images.length = 0;
  houseSceneMocks.keys.length = 0;
  houseSceneMocks.loaders.length = 0;
  houseSceneMocks.rectangles.length = 0;
  houseSceneMocks.renderers.length = 0;
  houseSceneMocks.scales.length = 0;
  MockMutationObserver.instances.length = 0;
  vi.clearAllMocks();
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("preloads and lays out the fullscreen house artwork and ambient night shadow using the active palette", async () => {
  document.documentElement.style.colorScheme = "dark";
  vi.stubGlobal("MutationObserver", MockMutationObserver);

  const { HouseScene } = await import("~/lib/house-scene");
  const scene = new HouseScene();

  expect(HouseScene.key).toBe("house");
  expect(houseSceneMocks.keys[0]).toBe(HouseScene.key);

  scene.preload();

  const load = houseSceneMocks.loaders[0];

  if (load === undefined) {
    throw new Error("Expected the House scene loader to be created.");
  }

  expect(load.image).toHaveBeenNthCalledWith(
    1,
    "house-room-shell-v1",
    "/world/v1/backgrounds/house-room-shell-v1.png",
  );
  expect(load.image).toHaveBeenCalledTimes(1);

  scene.create();

  const roomShell = houseSceneMocks.images[0];
  const ambientShadow = houseSceneMocks.rectangles[0];
  const camera = houseSceneMocks.cameras[0];
  const canvas = houseSceneMocks.canvases[0];
  const scale = houseSceneMocks.scales[0];
  const renderer = houseSceneMocks.renderers[0];
  const events = houseSceneMocks.events[0];
  const colorSchemeObserver = MockMutationObserver.instances[0];

  if (
    roomShell === undefined ||
    ambientShadow === undefined ||
    camera === undefined ||
    canvas === undefined ||
    scale === undefined ||
    renderer === undefined ||
    events === undefined ||
    colorSchemeObserver === undefined
  ) {
    throw new Error("Expected the House scene objects to be created.");
  }

  const roomShellLayoutCall = roomShell.setDisplaySize.mock.calls[0];
  const ambientShadowLayoutCall = ambientShadow.setDisplaySize.mock.calls[0];

  if (
    roomShellLayoutCall === undefined ||
    ambientShadowLayoutCall === undefined
  ) {
    throw new Error("Expected the House scene artwork to be laid out.");
  }

  expect(scene.add.image).toHaveBeenCalledTimes(1);
  expect(scene.add.image).toHaveBeenNthCalledWith(
    1,
    0,
    0,
    "house-room-shell-v1",
  );
  expect(scene.add.rectangle).toHaveBeenNthCalledWith(
    1,
    0,
    0,
    1,
    1,
    0x120d0b,
    0.22,
  );
  expect(roomShell.setOrigin).toHaveBeenCalledWith(0.5);
  expect(ambientShadow.setOrigin).toHaveBeenCalledWith(0.5);
  expect(roomShellLayoutCall[0]).toBeCloseTo(1280);
  expect(roomShellLayoutCall[1]).toBeCloseTo(853.3333333333);
  expect(ambientShadowLayoutCall).toEqual([1280, 720]);
  expect(roomShell.setPosition).toHaveBeenCalledWith(640, 360);
  expect(ambientShadow.setPosition).toHaveBeenCalledWith(640, 360);
  expect(ambientShadow.setFillStyle).toHaveBeenCalledWith(0x120d0b, 0.22);
  expect(camera.setBackgroundColor).toHaveBeenCalledWith("#0c0a09");
  expect(canvas.style.backgroundColor).toBe("#0c0a09");
  expect(renderer.config.backgroundColor).toBe("converted:#0c0a09");
  expect(colorSchemeObserver.observe).toHaveBeenCalledWith(
    document.documentElement,
    {
      attributeFilter: ["style"],
      attributes: true,
    },
  );
  expect(scale.on).toHaveBeenCalledWith(
    "resize-event",
    expect.any(Function),
    scene,
  );
  expect(events.once).toHaveBeenCalledWith(
    "shutdown-event",
    expect.any(Function),
    scene,
  );
});

test("builds the initial scene from the computed color scheme when inline style is unset", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    colorScheme: "dark",
  } as never);

  const { HouseScene } = await import("~/lib/house-scene");
  const scene = new HouseScene();

  scene.preload();
  scene.create();

  const ambientShadow = houseSceneMocks.rectangles[0];
  const camera = houseSceneMocks.cameras[0];
  const canvas = houseSceneMocks.canvases[0];
  const renderer = houseSceneMocks.renderers[0];

  if (
    ambientShadow === undefined ||
    camera === undefined ||
    canvas === undefined ||
    renderer === undefined
  ) {
    throw new Error("Expected the House scene to create its render targets.");
  }

  expect(ambientShadow.setFillStyle).toHaveBeenCalledWith(0x120d0b, 0.22);
  expect(camera.setBackgroundColor).toHaveBeenCalledWith("#0c0a09");
  expect(canvas.style.backgroundColor).toBe("#0c0a09");
  expect(renderer.config.backgroundColor).toBe("converted:#0c0a09");
});

test("responds to palette changes, resize events, and shutdown cleanup", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);

  const { HouseScene } = await import("~/lib/house-scene");
  const scene = new HouseScene();

  scene.preload();
  scene.create();

  const roomShell = houseSceneMocks.images[0];
  const ambientShadow = houseSceneMocks.rectangles[0];
  const scale = houseSceneMocks.scales[0];
  const events = houseSceneMocks.events[0];
  const camera = houseSceneMocks.cameras[0];
  const canvas = houseSceneMocks.canvases[0];
  const renderer = houseSceneMocks.renderers[0];
  const colorSchemeObserver = MockMutationObserver.instances[0];
  const resizeHandler = scale?.on.mock.calls[0]?.[1];
  const shutdownHandler = events?.once.mock.calls[0]?.[1];

  if (
    roomShell === undefined ||
    ambientShadow === undefined ||
    scale === undefined ||
    events === undefined ||
    resizeHandler === undefined ||
    shutdownHandler === undefined ||
    camera === undefined ||
    canvas === undefined ||
    renderer === undefined ||
    colorSchemeObserver === undefined
  ) {
    throw new Error("Expected the scene lifecycle callbacks to be registered.");
  }

  document.documentElement.style.colorScheme = "dark";
  colorSchemeObserver.notify();

  expect(ambientShadow.setFillStyle).toHaveBeenLastCalledWith(0x120d0b, 0.22);
  expect(camera.setBackgroundColor).toHaveBeenLastCalledWith("#0c0a09");
  expect(canvas.style.backgroundColor).toBe("#0c0a09");
  expect(renderer.config.backgroundColor).toBe("converted:#0c0a09");

  scale.width = 520;
  scale.height = 812;
  resizeHandler.call(scene);

  expect(ambientShadow.setDisplaySize).toHaveBeenLastCalledWith(520, 812);
  expect(ambientShadow.setPosition).toHaveBeenLastCalledWith(260, 406);
  expect(roomShell.setDisplaySize).toHaveBeenLastCalledWith(1218, 812);
  expect(roomShell.setPosition).toHaveBeenLastCalledWith(260, 406);

  shutdownHandler.call(scene);

  expect(colorSchemeObserver.disconnect).toHaveBeenCalledTimes(1);
  expect(scale.off).toHaveBeenCalledWith("resize-event", resizeHandler, scene);
  ambientShadow.setFillStyle.mockClear();
  roomShell.setPosition.mockClear();
  colorSchemeObserver.notify();
  expect(() => {
    resizeHandler.call(scene);
  }).not.toThrow();
  expect(ambientShadow.setFillStyle).not.toHaveBeenCalled();
  expect(roomShell.setPosition).not.toHaveBeenCalled();
});
