import { afterEach, expect, test, vi } from "vitest";

type MockCamera = {
  setBackgroundColor: ReturnType<typeof vi.fn>;
};

type MockCanvas = {
  style: {
    backgroundColor: string;
  };
};

type MockContainer = {
  add: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
};

type MockEventEmitter = {
  once: ReturnType<typeof vi.fn>;
};

type MockRectangle = {
  setFillStyle: ReturnType<typeof vi.fn>;
  setOrigin: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  setStrokeStyle: ReturnType<typeof vi.fn>;
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

type MockText = {
  setColor: ReturnType<typeof vi.fn>;
  setFontSize: ReturnType<typeof vi.fn>;
  setOrigin: ReturnType<typeof vi.fn>;
  setWordWrapWidth: ReturnType<typeof vi.fn>;
  setY: ReturnType<typeof vi.fn>;
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

function createMockContainer(): MockContainer {
  const container = {
    add: vi.fn(),
    setPosition: vi.fn(),
  };

  container.add.mockReturnValue(container);
  container.setPosition.mockReturnValue(container);

  return container;
}

function createMockEventEmitter(): MockEventEmitter {
  return {
    once: vi.fn(),
  };
}

function createMockRectangle(): MockRectangle {
  const rectangle = {
    setFillStyle: vi.fn(),
    setOrigin: vi.fn(),
    setSize: vi.fn(),
    setStrokeStyle: vi.fn(),
  };

  rectangle.setFillStyle.mockReturnValue(rectangle);
  rectangle.setOrigin.mockReturnValue(rectangle);
  rectangle.setSize.mockReturnValue(rectangle);
  rectangle.setStrokeStyle.mockReturnValue(rectangle);

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

function createMockText(): MockText {
  const text = {
    setColor: vi.fn(),
    setFontSize: vi.fn(),
    setOrigin: vi.fn(),
    setWordWrapWidth: vi.fn(),
    setY: vi.fn(),
  };

  text.setColor.mockReturnValue(text);
  text.setFontSize.mockReturnValue(text);
  text.setOrigin.mockReturnValue(text);
  text.setWordWrapWidth.mockReturnValue(text);
  text.setY.mockReturnValue(text);

  return text;
}

const houseSceneMocks = vi.hoisted(() => {
  const cameras: MockCamera[] = [];
  const canvases: MockCanvas[] = [];
  const containers: MockContainer[] = [];
  const events: MockEventEmitter[] = [];
  const keys: unknown[] = [];
  const rectangles: MockRectangle[] = [];
  const renderers: MockRenderer[] = [];
  const scales: MockScale[] = [];
  const texts: MockText[] = [];

  class MockScene {
    add = {
      container: vi.fn((_x: number, _y: number, _children: unknown[]) => {
        const container = createMockContainer();
        containers.push(container);
        return container;
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
      text: vi.fn(
        (
          _x: number,
          _y: number,
          _value: string,
          _style: Record<string, unknown>,
        ) => {
          const text = createMockText();
          texts.push(text);
          return text;
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
    MockScene,
    containers,
    events,
    keys,
    rectangles,
    renderers,
    scales,
    texts,
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
      Container: class Container {},
      Rectangle: class Rectangle {},
      Text: class Text {},
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
  houseSceneMocks.containers.length = 0;
  houseSceneMocks.events.length = 0;
  houseSceneMocks.keys.length = 0;
  houseSceneMocks.rectangles.length = 0;
  houseSceneMocks.renderers.length = 0;
  houseSceneMocks.scales.length = 0;
  houseSceneMocks.texts.length = 0;
  MockMutationObserver.instances.length = 0;
  vi.clearAllMocks();
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("builds and lays out the fullscreen placeholder scene using the active palette", async () => {
  document.documentElement.style.colorScheme = "dark";
  vi.stubGlobal("MutationObserver", MockMutationObserver);

  const { HouseScene } = await import("~/lib/house-scene");
  const scene = new HouseScene();

  expect(HouseScene.key).toBe("house");
  expect(houseSceneMocks.keys[0]).toBe(HouseScene.key);

  scene.create();

  const glow = houseSceneMocks.rectangles[0];
  const card = houseSceneMocks.rectangles[1];
  const title = houseSceneMocks.texts[0];
  const subtitle = houseSceneMocks.texts[1];
  const panel = houseSceneMocks.containers[0];
  const camera = houseSceneMocks.cameras[0];
  const canvas = houseSceneMocks.canvases[0];
  const scale = houseSceneMocks.scales[0];
  const renderer = houseSceneMocks.renderers[0];
  const events = houseSceneMocks.events[0];
  const colorSchemeObserver = MockMutationObserver.instances[0];

  if (
    glow === undefined ||
    card === undefined ||
    title === undefined ||
    subtitle === undefined ||
    panel === undefined ||
    camera === undefined ||
    canvas === undefined ||
    scale === undefined ||
    renderer === undefined ||
    events === undefined ||
    colorSchemeObserver === undefined
  ) {
    throw new Error("Expected the House scene objects to be created.");
  }

  expect(scene.add.rectangle).toHaveBeenCalledTimes(2);
  expect(scene.add.text).toHaveBeenCalledTimes(2);
  expect(scene.add.text).toHaveBeenNthCalledWith(
    1,
    0,
    -48,
    "OpenKitten",
    expect.objectContaining({
      color: "#fafaf9",
      fontSize: "42px",
      fontStyle: "700",
    }),
  );
  expect(scene.add.text).toHaveBeenNthCalledWith(
    2,
    0,
    28,
    "Phaser is running fullscreen on `/`.\nThe real House comes next.",
    expect.objectContaining({
      color: "#a6a09b",
      lineSpacing: 8,
    }),
  );
  expect(scene.add.rectangle).toHaveBeenNthCalledWith(
    1,
    0,
    0,
    612,
    332,
    0x973c00,
    0.24,
  );
  expect(scene.add.rectangle).toHaveBeenNthCalledWith(
    2,
    0,
    0,
    560,
    280,
    0x1c1917,
    0.96,
  );
  expect(scene.add.container).toHaveBeenCalledWith(640, 360, [
    glow,
    card,
    title,
    subtitle,
  ]);
  expect(glow.setFillStyle).toHaveBeenCalledWith(0x973c00, 0.24);
  expect(card.setFillStyle).toHaveBeenCalledWith(0x1c1917, 0.96);
  expect(card.setStrokeStyle).toHaveBeenLastCalledWith(2, 0xffffff, 0.1);
  expect(title.setColor).toHaveBeenCalledWith("#fafaf9");
  expect(subtitle.setColor).toHaveBeenCalledWith("#a6a09b");
  expect(glow.setSize).toHaveBeenCalledWith(612, 332);
  expect(card.setSize).toHaveBeenCalledWith(560, 280);
  expect(panel.setPosition).toHaveBeenCalledWith(640, 360);
  expect(title.setFontSize).toHaveBeenCalledWith("42px");
  expect(subtitle.setWordWrapWidth).toHaveBeenCalledWith(496, true);
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

  scene.create();

  const camera = houseSceneMocks.cameras[0];
  const canvas = houseSceneMocks.canvases[0];
  const renderer = houseSceneMocks.renderers[0];

  if (camera === undefined || canvas === undefined || renderer === undefined) {
    throw new Error("Expected the House scene to create its render targets.");
  }

  expect(scene.add.text).toHaveBeenNthCalledWith(
    1,
    0,
    -48,
    "OpenKitten",
    expect.objectContaining({
      color: "#fafaf9",
    }),
  );
  expect(scene.add.rectangle).toHaveBeenNthCalledWith(
    1,
    0,
    0,
    612,
    332,
    0x973c00,
    0.24,
  );
  expect(camera.setBackgroundColor).toHaveBeenCalledWith("#0c0a09");
  expect(canvas.style.backgroundColor).toBe("#0c0a09");
  expect(renderer.config.backgroundColor).toBe("converted:#0c0a09");
});

test("responds to palette changes, resize events, and shutdown cleanup", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);

  const { HouseScene } = await import("~/lib/house-scene");
  const scene = new HouseScene();

  scene.create();

  const glow = houseSceneMocks.rectangles[0];
  const scale = houseSceneMocks.scales[0];
  const events = houseSceneMocks.events[0];
  const card = houseSceneMocks.rectangles[1];
  const panel = houseSceneMocks.containers[0];
  const title = houseSceneMocks.texts[0];
  const subtitle = houseSceneMocks.texts[1];
  const camera = houseSceneMocks.cameras[0];
  const canvas = houseSceneMocks.canvases[0];
  const renderer = houseSceneMocks.renderers[0];
  const colorSchemeObserver = MockMutationObserver.instances[0];
  const resizeHandler = scale?.on.mock.calls[0]?.[1];
  const shutdownHandler = events?.once.mock.calls[0]?.[1];

  if (
    glow === undefined ||
    scale === undefined ||
    events === undefined ||
    resizeHandler === undefined ||
    shutdownHandler === undefined ||
    card === undefined ||
    panel === undefined ||
    title === undefined ||
    subtitle === undefined ||
    camera === undefined ||
    canvas === undefined ||
    renderer === undefined ||
    colorSchemeObserver === undefined
  ) {
    throw new Error("Expected the scene lifecycle callbacks to be registered.");
  }

  document.documentElement.style.colorScheme = "dark";
  colorSchemeObserver.notify();

  expect(glow.setFillStyle).toHaveBeenLastCalledWith(0x973c00, 0.24);
  expect(card.setFillStyle).toHaveBeenLastCalledWith(0x1c1917, 0.96);
  expect(title.setColor).toHaveBeenLastCalledWith("#fafaf9");
  expect(subtitle.setColor).toHaveBeenLastCalledWith("#a6a09b");
  expect(camera.setBackgroundColor).toHaveBeenLastCalledWith("#0c0a09");
  expect(canvas.style.backgroundColor).toBe("#0c0a09");
  expect(renderer.config.backgroundColor).toBe("converted:#0c0a09");

  scale.width = 520;
  scale.height = 812;
  resizeHandler.call(scene);

  expect(card.setSize).toHaveBeenLastCalledWith(472, 240);
  expect(panel.setPosition).toHaveBeenLastCalledWith(260, 406);
  expect(title.setFontSize).toHaveBeenLastCalledWith("30px");
  expect(subtitle.setWordWrapWidth).toHaveBeenLastCalledWith(408, true);

  shutdownHandler.call(scene);

  expect(colorSchemeObserver.disconnect).toHaveBeenCalledTimes(1);
  expect(scale.off).toHaveBeenCalledWith("resize-event", resizeHandler, scene);
  title.setColor.mockClear();
  colorSchemeObserver.notify();
  expect(() => {
    resizeHandler.call(scene);
  }).not.toThrow();
  expect(title.setColor).not.toHaveBeenCalled();
});
