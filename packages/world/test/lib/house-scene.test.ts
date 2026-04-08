import { afterEach, expect, test, vi } from "vitest";

type MockContainer = {
  add: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
};

type MockEventEmitter = {
  once: ReturnType<typeof vi.fn>;
};

type MockRectangle = {
  setOrigin: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  setStrokeStyle: ReturnType<typeof vi.fn>;
};

type MockScale = {
  height: number;
  off: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  width: number;
};

type MockText = {
  setFontSize: ReturnType<typeof vi.fn>;
  setOrigin: ReturnType<typeof vi.fn>;
  setWordWrapWidth: ReturnType<typeof vi.fn>;
  setY: ReturnType<typeof vi.fn>;
};

function createMockRectangle(): MockRectangle {
  const rectangle = {
    setOrigin: vi.fn(),
    setSize: vi.fn(),
    setStrokeStyle: vi.fn(),
  };

  rectangle.setOrigin.mockReturnValue(rectangle);
  rectangle.setSize.mockReturnValue(rectangle);
  rectangle.setStrokeStyle.mockReturnValue(rectangle);

  return rectangle;
}

function createMockText(): MockText {
  const text = {
    setFontSize: vi.fn(),
    setOrigin: vi.fn(),
    setWordWrapWidth: vi.fn(),
    setY: vi.fn(),
  };

  text.setFontSize.mockReturnValue(text);
  text.setOrigin.mockReturnValue(text);
  text.setWordWrapWidth.mockReturnValue(text);
  text.setY.mockReturnValue(text);

  return text;
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
  const events = {
    once: vi.fn(),
  };

  return events;
}

function createMockScale(): MockScale {
  const scale = {
    height: 720,
    off: vi.fn(),
    on: vi.fn(),
    width: 1280,
  };

  return scale;
}

const houseSceneMocks = vi.hoisted(() => {
  const rectangles: MockRectangle[] = [];
  const texts: MockText[] = [];
  const containers: MockContainer[] = [];
  const events: MockEventEmitter[] = [];
  const scales: MockScale[] = [];
  const keys: unknown[] = [];

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
    events = createMockEventEmitter();

    scale = createMockScale();

    constructor(key?: unknown) {
      keys.push(key);
      events.push(this.events);
      scales.push(this.scale);
    }
  }

  return {
    MockScene,
    containers,
    events,
    keys,
    rectangles,
    scales,
    texts,
  };
});

vi.mock("phaser", () => ({
  default: {
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
  houseSceneMocks.containers.length = 0;
  houseSceneMocks.events.length = 0;
  houseSceneMocks.keys.length = 0;
  houseSceneMocks.rectangles.length = 0;
  houseSceneMocks.scales.length = 0;
  houseSceneMocks.texts.length = 0;
  vi.clearAllMocks();
  vi.resetModules();
});

test("builds and lays out the fullscreen placeholder scene", async () => {
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
  const scale = houseSceneMocks.scales[0];
  const events = houseSceneMocks.events[0];

  if (
    glow === undefined ||
    card === undefined ||
    title === undefined ||
    subtitle === undefined ||
    panel === undefined ||
    scale === undefined ||
    events === undefined
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
      color: "#1c1917",
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
      color: "#78716c",
      lineSpacing: 8,
    }),
  );
  expect(scene.add.rectangle).toHaveBeenNthCalledWith(
    1,
    0,
    0,
    612,
    332,
    0xd97706,
    0.16,
  );
  expect(scene.add.rectangle).toHaveBeenNthCalledWith(
    2,
    0,
    0,
    560,
    280,
    0xffffff,
    0.96,
  );
  expect(scene.add.container).toHaveBeenCalledWith(640, 360, [
    glow,
    card,
    title,
    subtitle,
  ]);
  expect(card.setStrokeStyle).toHaveBeenLastCalledWith(2, 0xe7e5e4, 1);
  expect(glow.setSize).toHaveBeenCalledWith(612, 332);
  expect(card.setSize).toHaveBeenCalledWith(560, 280);
  expect(panel.setPosition).toHaveBeenCalledWith(640, 360);
  expect(title.setFontSize).toHaveBeenCalledWith("42px");
  expect(subtitle.setWordWrapWidth).toHaveBeenCalledWith(496, true);
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

test("responds to resize events and clears the listener on shutdown", async () => {
  const { HouseScene } = await import("~/lib/house-scene");
  const scene = new HouseScene();

  scene.create();

  const scale = houseSceneMocks.scales[0];
  const events = houseSceneMocks.events[0];
  const card = houseSceneMocks.rectangles[1];
  const panel = houseSceneMocks.containers[0];
  const title = houseSceneMocks.texts[0];
  const subtitle = houseSceneMocks.texts[1];
  const resizeHandler = scale?.on.mock.calls[0]?.[1];
  const shutdownHandler = events?.once.mock.calls[0]?.[1];

  if (
    scale === undefined ||
    events === undefined ||
    resizeHandler === undefined ||
    shutdownHandler === undefined ||
    card === undefined ||
    panel === undefined ||
    title === undefined ||
    subtitle === undefined
  ) {
    throw new Error("Expected the scene lifecycle callbacks to be registered.");
  }

  scale.width = 520;
  scale.height = 812;
  resizeHandler.call(scene);

  expect(card.setSize).toHaveBeenLastCalledWith(472, 240);
  expect(panel.setPosition).toHaveBeenLastCalledWith(260, 406);
  expect(title.setFontSize).toHaveBeenLastCalledWith("30px");
  expect(subtitle.setWordWrapWidth).toHaveBeenLastCalledWith(408, true);

  shutdownHandler.call(scene);

  expect(scale.off).toHaveBeenCalledWith("resize-event", resizeHandler, scene);
  expect(() => {
    resizeHandler.call(scene);
  }).not.toThrow();
});
