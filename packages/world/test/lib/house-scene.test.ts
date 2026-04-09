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
  key: string;
  setAlpha: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
  setDisplaySize: ReturnType<typeof vi.fn>;
  setOrigin: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setScale: ReturnType<typeof vi.fn>;
};

type MockRectangle = {
  setDepth: ReturnType<typeof vi.fn>;
  setFillStyle: ReturnType<typeof vi.fn>;
  setOrigin: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
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

function createMockImage(key: string): MockImage {
  const image = {
    key,
    setAlpha: vi.fn(),
    setDepth: vi.fn(),
    setDisplaySize: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setScale: vi.fn(),
  };

  image.setAlpha.mockReturnValue(image);
  image.setDepth.mockReturnValue(image);
  image.setDisplaySize.mockReturnValue(image);
  image.setOrigin.mockReturnValue(image);
  image.setPosition.mockReturnValue(image);
  image.setScale.mockReturnValue(image);

  return image;
}

function createMockRectangle(): MockRectangle {
  const rectangle = {
    setDepth: vi.fn(),
    setFillStyle: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setSize: vi.fn(),
  };

  rectangle.setDepth.mockReturnValue(rectangle);
  rectangle.setFillStyle.mockReturnValue(rectangle);
  rectangle.setOrigin.mockReturnValue(rectangle);
  rectangle.setPosition.mockReturnValue(rectangle);
  rectangle.setSize.mockReturnValue(rectangle);

  return rectangle;
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

const houseSceneMocks = vi.hoisted(() => {
  const cameras: MockCamera[] = [];
  const canvases: MockCanvas[] = [];
  const events: MockEventEmitter[] = [];
  const images: MockImage[] = [];
  const keys: unknown[] = [];
  const rectangles: MockRectangle[] = [];
  const renderers: MockRenderer[] = [];
  const scales: MockScale[] = [];

  class MockScene {
    add = {
      image: vi.fn((_x: number, _y: number, key: string) => {
        const image = createMockImage(key);
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
          const rectangle = createMockRectangle();
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
    scale = createMockScale();

    constructor(key?: unknown) {
      keys.push(key);
      cameras.push(this.cameras.main);
      canvases.push(this.game.canvas);
      events.push(this.events);
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

function getImagesByKey(key: string) {
  return houseSceneMocks.images.filter((image) => image.key === key);
}

afterEach(() => {
  document.documentElement.style.colorScheme = "";
  houseSceneMocks.cameras.length = 0;
  houseSceneMocks.canvases.length = 0;
  houseSceneMocks.events.length = 0;
  houseSceneMocks.images.length = 0;
  houseSceneMocks.keys.length = 0;
  houseSceneMocks.rectangles.length = 0;
  houseSceneMocks.renderers.length = 0;
  houseSceneMocks.scales.length = 0;
  MockMutationObserver.instances.length = 0;
  vi.clearAllMocks();
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("builds the simplified room shell with only the background and two cats", async () => {
  document.documentElement.style.colorScheme = "dark";
  vi.stubGlobal("MutationObserver", MockMutationObserver);

  const { HouseScene } = await import("~/lib/house-scene");
  const { houseLayout } = await import("~/lib/house-layout");
  const { worldAssets } = await import("~/lib/world-assets");
  const scene = new HouseScene();

  expect(HouseScene.key).toBe("house");
  expect(houseSceneMocks.keys[0]).toBe(HouseScene.key);

  scene.create();

  const background = getImagesByKey(worldAssets.backgrounds.roomShell.key)[0];
  const catShadows = getImagesByKey(worldAssets.fx.catShadow.key);
  const mochi = getImagesByKey(worldAssets.cats.catAAwake.key)[0];
  const saffron = getImagesByKey(worldAssets.cats.catBResting.key)[0];
  const ambientShade = houseSceneMocks.rectangles[0];
  const camera = houseSceneMocks.cameras[0];
  const canvas = houseSceneMocks.canvases[0];
  const scale = houseSceneMocks.scales[0];
  const renderer = houseSceneMocks.renderers[0];
  const events = houseSceneMocks.events[0];
  const colorSchemeObserver = MockMutationObserver.instances[0];

  if (
    background === undefined ||
    catShadows[0] === undefined ||
    catShadows[1] === undefined ||
    mochi === undefined ||
    saffron === undefined ||
    ambientShade === undefined ||
    camera === undefined ||
    canvas === undefined ||
    scale === undefined ||
    renderer === undefined ||
    events === undefined ||
    colorSchemeObserver === undefined
  ) {
    throw new Error("Expected the simplified House scene objects to exist.");
  }

  expect(scene.add.image).toHaveBeenCalledTimes(5);
  expect(scene.add.rectangle).toHaveBeenCalledTimes(1);
  expect(background.setDisplaySize).toHaveBeenCalledWith(
    1280,
    (houseLayout.sceneSize.height * 1280) / houseLayout.sceneSize.width,
  );
  expect(catShadows[0].setAlpha).toHaveBeenCalledWith(
    houseLayout.cats[0]?.shadowAlpha,
  );
  expect(catShadows[1].setAlpha).toHaveBeenCalledWith(
    houseLayout.cats[1]?.shadowAlpha,
  );
  expect(mochi.setScale).toHaveBeenLastCalledWith(
    houseLayout.cats[0]?.scale * (1280 / houseLayout.sceneSize.width),
  );
  expect(saffron.setScale).toHaveBeenLastCalledWith(
    houseLayout.cats[1]?.scale * (1280 / houseLayout.sceneSize.width),
  );
  expect(ambientShade.setFillStyle).toHaveBeenCalledWith(0x120c08, 0.2);
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

test("responds to palette changes, resize events, and shutdown cleanup", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);

  const { HouseScene } = await import("~/lib/house-scene");
  const { worldAssets } = await import("~/lib/world-assets");
  const scene = new HouseScene();

  scene.create();

  const background = getImagesByKey(worldAssets.backgrounds.roomShell.key)[0];
  const ambientShade = houseSceneMocks.rectangles[0];
  const scale = houseSceneMocks.scales[0];
  const events = houseSceneMocks.events[0];
  const camera = houseSceneMocks.cameras[0];
  const canvas = houseSceneMocks.canvases[0];
  const renderer = houseSceneMocks.renderers[0];
  const colorSchemeObserver = MockMutationObserver.instances[0];
  const resizeHandler = scale?.on.mock.calls[0]?.[1];
  const shutdownHandler = events?.once.mock.calls[0]?.[1];

  if (
    background === undefined ||
    ambientShade === undefined ||
    scale === undefined ||
    events === undefined ||
    camera === undefined ||
    canvas === undefined ||
    renderer === undefined ||
    colorSchemeObserver === undefined ||
    resizeHandler === undefined ||
    shutdownHandler === undefined
  ) {
    throw new Error("Expected the scene lifecycle callbacks to be registered.");
  }

  document.documentElement.style.colorScheme = "dark";
  colorSchemeObserver.notify();

  expect(ambientShade.setFillStyle).toHaveBeenLastCalledWith(0x120c08, 0.2);
  expect(camera.setBackgroundColor).toHaveBeenLastCalledWith("#0c0a09");
  expect(canvas.style.backgroundColor).toBe("#0c0a09");
  expect(renderer.config.backgroundColor).toBe("converted:#0c0a09");

  scale.width = 520;
  scale.height = 812;
  resizeHandler.call(scene);

  expect(background.setDisplaySize).toHaveBeenLastCalledWith(1218, 812);

  shutdownHandler.call(scene);

  expect(colorSchemeObserver.disconnect).toHaveBeenCalledTimes(1);
  expect(scale.off).toHaveBeenCalledWith("resize-event", resizeHandler, scene);
  ambientShade.setFillStyle.mockClear();
  colorSchemeObserver.notify();
  expect(() => {
    resizeHandler.call(scene);
  }).not.toThrow();
  expect(ambientShade.setFillStyle).not.toHaveBeenCalled();
});

test("builds the room shell from the computed color scheme when inline style is unset", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    colorScheme: "dark",
  } as never);

  const { HouseScene } = await import("~/lib/house-scene");
  const scene = new HouseScene();

  scene.create();

  const ambientShade = houseSceneMocks.rectangles[0];
  const camera = houseSceneMocks.cameras[0];

  if (ambientShade === undefined || camera === undefined) {
    throw new Error("Expected the themed room shell to exist.");
  }

  expect(ambientShade.setFillStyle).toHaveBeenCalledWith(0x120c08, 0.2);
  expect(camera.setBackgroundColor).toHaveBeenCalledWith("#0c0a09");
});
