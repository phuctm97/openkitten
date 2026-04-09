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
  eventHandlers: Map<string, () => void>;
  key: string;
  on: ReturnType<typeof vi.fn>;
  setAlpha: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
  setDisplaySize: ReturnType<typeof vi.fn>;
  setInteractive: ReturnType<typeof vi.fn>;
  setOrigin: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setScale: ReturnType<typeof vi.fn>;
  setTint: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
};

type MockRectangle = {
  setDepth: ReturnType<typeof vi.fn>;
  setFillStyle: ReturnType<typeof vi.fn>;
  setOrigin: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
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
  setDepth: ReturnType<typeof vi.fn>;
  setFontSize: ReturnType<typeof vi.fn>;
  setOrigin: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setText: ReturnType<typeof vi.fn>;
  setWordWrapWidth: ReturnType<typeof vi.fn>;
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
  const eventHandlers = new Map<string, () => void>();
  const image = {
    eventHandlers,
    key,
    on: vi.fn((eventName: string, handler: () => void) => {
      eventHandlers.set(eventName, handler);
      return image;
    }),
    setAlpha: vi.fn(),
    setDepth: vi.fn(),
    setDisplaySize: vi.fn(),
    setInteractive: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setScale: vi.fn(),
    setTint: vi.fn(),
    setVisible: vi.fn(),
  };

  image.setAlpha.mockReturnValue(image);
  image.setDepth.mockReturnValue(image);
  image.setDisplaySize.mockReturnValue(image);
  image.setInteractive.mockReturnValue(image);
  image.setOrigin.mockReturnValue(image);
  image.setPosition.mockReturnValue(image);
  image.setScale.mockReturnValue(image);
  image.setTint.mockReturnValue(image);
  image.setVisible.mockReturnValue(image);

  return image;
}

function createMockRectangle(): MockRectangle {
  const rectangle = {
    setDepth: vi.fn(),
    setFillStyle: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setSize: vi.fn(),
    setStrokeStyle: vi.fn(),
  };

  rectangle.setDepth.mockReturnValue(rectangle);
  rectangle.setFillStyle.mockReturnValue(rectangle);
  rectangle.setOrigin.mockReturnValue(rectangle);
  rectangle.setPosition.mockReturnValue(rectangle);
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
    setDepth: vi.fn(),
    setFontSize: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setText: vi.fn(),
    setWordWrapWidth: vi.fn(),
  };

  text.setColor.mockReturnValue(text);
  text.setDepth.mockReturnValue(text);
  text.setFontSize.mockReturnValue(text);
  text.setOrigin.mockReturnValue(text);
  text.setPosition.mockReturnValue(text);
  text.setText.mockReturnValue(text);
  text.setWordWrapWidth.mockReturnValue(text);

  return text;
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
  const texts: MockText[] = [];

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
    events,
    images,
    keys,
    MockScene,
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
      Image: class Image {},
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
  houseSceneMocks.texts.length = 0;
  MockMutationObserver.instances.length = 0;
  vi.clearAllMocks();
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("builds the layered room shell and focuses the awake cat by default", async () => {
  document.documentElement.style.colorScheme = "dark";
  vi.stubGlobal("MutationObserver", MockMutationObserver);

  const { HouseScene } = await import("~/lib/house-scene");
  const { houseLayout } = await import("~/lib/house-layout");
  const { worldAssets } = await import("~/lib/world-assets");
  const scene = new HouseScene();
  const panelScale = 1_280 / 1_400;

  expect(HouseScene.key).toBe("house");
  expect(houseSceneMocks.keys[0]).toBe(HouseScene.key);

  scene.create();

  const background = getImagesByKey(worldAssets.backgrounds.roomShell.key)[0];
  const hoverRing = getImagesByKey(worldAssets.fx.hoverRing.key)[0];
  const mochiImages = getImagesByKey(worldAssets.cats.catAAwake.key);
  const panelGlow = houseSceneMocks.rectangles[1];
  const panelCard = houseSceneMocks.rectangles[2];
  const panelAccent = houseSceneMocks.rectangles[3];
  const panelTitle = houseSceneMocks.texts[0];
  const panelMeta = houseSceneMocks.texts[1];
  const panelBody = houseSceneMocks.texts[2];
  const camera = houseSceneMocks.cameras[0];
  const canvas = houseSceneMocks.canvases[0];
  const scale = houseSceneMocks.scales[0];
  const renderer = houseSceneMocks.renderers[0];
  const events = houseSceneMocks.events[0];
  const colorSchemeObserver = MockMutationObserver.instances[0];

  if (
    background === undefined ||
    hoverRing === undefined ||
    mochiImages[0] === undefined ||
    mochiImages[1] === undefined ||
    panelGlow === undefined ||
    panelCard === undefined ||
    panelAccent === undefined ||
    panelTitle === undefined ||
    panelMeta === undefined ||
    panelBody === undefined ||
    camera === undefined ||
    canvas === undefined ||
    scale === undefined ||
    renderer === undefined ||
    events === undefined ||
    colorSchemeObserver === undefined
  ) {
    throw new Error("Expected the room shell objects to be created.");
  }

  expect(scene.add.image).toHaveBeenCalledWith(
    0,
    0,
    worldAssets.backgrounds.roomShell.key,
  );
  expect(scene.add.image).toHaveBeenCalledWith(
    0,
    0,
    worldAssets.backgrounds.foregroundTrim.key,
  );
  expect(scene.add.image).toHaveBeenCalledWith(
    0,
    0,
    worldAssets.fx.hoverRing.key,
  );
  expect(scene.add.image).toHaveBeenCalledWith(
    0,
    0,
    worldAssets.ui.inspectPanel.key,
  );
  expect(scene.add.image).toHaveBeenCalledTimes(19);
  expect(scene.add.rectangle).toHaveBeenCalledTimes(4);
  expect(scene.add.text).toHaveBeenCalledTimes(3);
  expect(background.setDisplaySize).toHaveBeenCalledWith(
    1_280,
    (houseLayout.sceneSize.height * 1_280) / houseLayout.sceneSize.width,
  );
  expect(panelGlow.setFillStyle).toHaveBeenCalledWith(0x973c00, 0.32);
  expect(panelCard.setFillStyle).toHaveBeenCalledWith(0x1c1917, 0.9);
  expect(panelCard.setStrokeStyle).toHaveBeenLastCalledWith(2, 0xffffff, 0.1);
  expect(panelAccent.setFillStyle).toHaveBeenCalledWith(0x973c00, 1);
  expect(panelTitle.setText).toHaveBeenLastCalledWith("Mochi");
  expect(panelMeta.setText).toHaveBeenLastCalledWith("Mochi · Awake");
  expect(panelBody.setText).toHaveBeenLastCalledWith(
    houseLayout.inspectables[3]?.description,
  );
  expect(panelBody.setWordWrapWidth).toHaveBeenLastCalledWith(
    houseLayout.panel.width * panelScale - 56 * panelScale,
    true,
  );
  expect(hoverRing.setVisible).toHaveBeenLastCalledWith(true);
  expect(mochiImages[0]?.setAlpha).toHaveBeenLastCalledWith(0.18);
  expect(mochiImages[1]?.setInteractive).toHaveBeenCalledWith({
    useHandCursor: true,
  });
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

test("updates focus as the user hovers and selects cats or work objects", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);

  const { HouseScene } = await import("~/lib/house-scene");
  const { worldAssets } = await import("~/lib/world-assets");
  const scene = new HouseScene();

  scene.create();

  const inboxSprite = getImagesByKey(worldAssets.props.inboxStation.key)[1];
  const saffronSprite = getImagesByKey(worldAssets.cats.catBResting.key)[1];
  const hoverRing = getImagesByKey(worldAssets.fx.hoverRing.key)[0];
  const panelTitle = houseSceneMocks.texts[0];
  const panelMeta = houseSceneMocks.texts[1];

  if (
    inboxSprite === undefined ||
    saffronSprite === undefined ||
    hoverRing === undefined ||
    panelTitle === undefined ||
    panelMeta === undefined
  ) {
    throw new Error("Expected focusable room sprites to exist.");
  }

  inboxSprite.eventHandlers.get("pointerover")?.();

  expect(panelTitle.setText).toHaveBeenLastCalledWith("Inbox");
  expect(panelMeta.setText).toHaveBeenLastCalledWith("Notice Station");
  expect(hoverRing.setVisible).toHaveBeenLastCalledWith(false);

  inboxSprite.eventHandlers.get("pointerout")?.();

  expect(panelTitle.setText).toHaveBeenLastCalledWith("Mochi");
  expect(panelMeta.setText).toHaveBeenLastCalledWith("Mochi · Awake");
  expect(hoverRing.setVisible).toHaveBeenLastCalledWith(true);

  saffronSprite.eventHandlers.get("pointerover")?.();
  saffronSprite.eventHandlers.get("pointerdown")?.();
  saffronSprite.eventHandlers.get("pointerout")?.();

  expect(panelTitle.setText).toHaveBeenLastCalledWith("Saffron");
  expect(panelMeta.setText).toHaveBeenLastCalledWith("Saffron · Resting");
  expect(hoverRing.setVisible).toHaveBeenLastCalledWith(true);
});

test("responds to palette changes, resize events, and shutdown cleanup", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);

  const { HouseScene } = await import("~/lib/house-scene");
  const { worldAssets } = await import("~/lib/world-assets");
  const scene = new HouseScene();

  scene.create();

  const background = getImagesByKey(worldAssets.backgrounds.roomShell.key)[0];
  const ambientShade = houseSceneMocks.rectangles[0];
  const panelCard = houseSceneMocks.rectangles[2];
  const panelTitle = houseSceneMocks.texts[0];
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
    panelCard === undefined ||
    panelTitle === undefined ||
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
  expect(panelCard.setFillStyle).toHaveBeenLastCalledWith(0x1c1917, 0.9);
  expect(panelTitle.setColor).toHaveBeenLastCalledWith("#fafaf9");
  expect(camera.setBackgroundColor).toHaveBeenLastCalledWith("#0c0a09");
  expect(canvas.style.backgroundColor).toBe("#0c0a09");
  expect(renderer.config.backgroundColor).toBe("converted:#0c0a09");

  scale.width = 520;
  scale.height = 812;
  resizeHandler.call(scene);

  expect(background.setDisplaySize).toHaveBeenLastCalledWith(1_218, 812);
  expect(panelCard.setSize).toHaveBeenLastCalledWith(388.8, 97.92);

  shutdownHandler.call(scene);

  expect(colorSchemeObserver.disconnect).toHaveBeenCalledTimes(1);
  expect(scale.off).toHaveBeenCalledWith("resize-event", resizeHandler, scene);
  panelTitle.setColor.mockClear();
  colorSchemeObserver.notify();
  expect(() => {
    resizeHandler.call(scene);
  }).not.toThrow();
  expect(panelTitle.setColor).not.toHaveBeenCalled();
});

test("builds the room shell from the computed color scheme when inline style is unset", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    colorScheme: "dark",
  } as never);

  const { HouseScene } = await import("~/lib/house-scene");
  const scene = new HouseScene();

  scene.create();

  const panelCard = houseSceneMocks.rectangles[2];
  const panelTitle = houseSceneMocks.texts[0];
  const camera = houseSceneMocks.cameras[0];

  if (
    panelCard === undefined ||
    panelTitle === undefined ||
    camera === undefined
  ) {
    throw new Error("Expected the themed room shell to exist.");
  }

  expect(panelCard.setFillStyle).toHaveBeenCalledWith(0x1c1917, 0.9);
  expect(panelTitle.setColor).toHaveBeenCalledWith("#fafaf9");
  expect(camera.setBackgroundColor).toHaveBeenCalledWith("#0c0a09");
});
