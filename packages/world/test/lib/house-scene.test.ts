import { afterEach, expect, test, vi } from "vitest";

const phaserEventNames = vi.hoisted(() => ({
  gameObjectPointerDown: "gameobject-pointer-down-event",
  gameObjectPointerOut: "gameobject-pointer-out-event",
  gameObjectPointerOver: "gameobject-pointer-over-event",
  gameObjectPointerUp: "gameobject-pointer-up-event",
  pointerDown: "pointer-down-event",
  pointerMove: "pointer-move-event",
  pointerUp: "pointer-up-event",
  pointerUpOutside: "pointer-up-outside-event",
  resize: "resize-event",
  shutdown: "shutdown-event",
}));

type MockCamera = {
  height: number;
  scrollX: number;
  scrollY: number;
  setBackgroundColor: ReturnType<typeof vi.fn>;
  setBounds: ReturnType<typeof vi.fn>;
  setScroll: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  setViewport: ReturnType<typeof vi.fn>;
  setZoom: ReturnType<typeof vi.fn>;
  width: number;
  zoom: number;
};

type MockCanvas = {
  style: {
    backgroundColor: string;
    cursor: string;
    touchAction: string;
  };
};

type MockEventEmitter = {
  once: ReturnType<typeof vi.fn>;
};

type MockImage = {
  alpha: number;
  depth: number;
  emit: (event: string, ...args: unknown[]) => void;
  interactive: boolean;
  key: string;
  on: ReturnType<typeof vi.fn>;
  setAlpha: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
  setDisplaySize: ReturnType<typeof vi.fn>;
  setInteractive: ReturnType<typeof vi.fn>;
  setOrigin: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  visible: boolean;
};

type MockInput = {
  off: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
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
    height: 720,
    scrollX: 0,
    scrollY: 0,
    setBackgroundColor: vi.fn(),
    setBounds: vi.fn(),
    setScroll: vi.fn((x: number, y: number) => {
      camera.scrollX = x;
      camera.scrollY = y;
      return camera;
    }),
    setSize: vi.fn((width: number, height: number) => {
      camera.width = width;
      camera.height = height;
      return camera;
    }),
    setViewport: vi.fn(),
    setZoom: vi.fn((zoom: number) => {
      camera.zoom = zoom;
      return camera;
    }),
    width: 1280,
    zoom: 1,
  };

  camera.setBackgroundColor.mockReturnValue(camera);
  camera.setBounds.mockReturnValue(camera);
  camera.setViewport.mockReturnValue(camera);

  return camera;
}

function createMockCanvas(): MockCanvas {
  return {
    style: {
      backgroundColor: "",
      cursor: "",
      touchAction: "",
    },
  };
}

function createMockEventEmitter(): MockEventEmitter {
  return {
    once: vi.fn(),
  };
}

function createMockImage(key: string): MockImage {
  const eventHandlers = new Map<string, (...args: unknown[]) => void>();
  const image = {
    alpha: 1,
    depth: 0,
    emit(event: string, ...args: unknown[]) {
      eventHandlers.get(event)?.(...args);
    },
    interactive: false,
    key,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      eventHandlers.set(event, handler);
      return image;
    }),
    setAlpha: vi.fn((alpha: number) => {
      image.alpha = alpha;
      return image;
    }),
    setDepth: vi.fn((depth: number) => {
      image.depth = depth;
      return image;
    }),
    setDisplaySize: vi.fn(),
    setInteractive: vi.fn(() => {
      image.interactive = true;
      return image;
    }),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setVisible: vi.fn((visible: boolean) => {
      image.visible = visible;
      return image;
    }),
    visible: true,
  };

  image.setDisplaySize.mockReturnValue(image);
  image.setOrigin.mockReturnValue(image);
  image.setPosition.mockReturnValue(image);

  return image;
}

function createMockInput(): MockInput {
  return {
    off: vi.fn(),
    on: vi.fn(),
  };
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

function findImage(key: string, occurrence = 0) {
  const images = houseSceneMocks.images.filter((image) => image.key === key);

  return images[occurrence];
}

const houseSceneMocks = vi.hoisted(() => {
  const cameras: MockCamera[] = [];
  const canvases: MockCanvas[] = [];
  const events: MockEventEmitter[] = [];
  const images: MockImage[] = [];
  const inputs: MockInput[] = [];
  const keys: unknown[] = [];
  const loaders: MockLoader[] = [];
  const rectangles: MockShape[] = [];
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
    input = createMockInput();
    load = createMockLoader();
    scale = createMockScale();

    constructor(key?: unknown) {
      keys.push(key);
      cameras.push(this.cameras.main);
      canvases.push(this.game.canvas);
      events.push(this.events);
      inputs.push(this.input);
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
    inputs,
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
    Input: {
      Events: {
        GAMEOBJECT_POINTER_DOWN: phaserEventNames.gameObjectPointerDown,
        GAMEOBJECT_POINTER_OUT: phaserEventNames.gameObjectPointerOut,
        GAMEOBJECT_POINTER_OVER: phaserEventNames.gameObjectPointerOver,
        GAMEOBJECT_POINTER_UP: phaserEventNames.gameObjectPointerUp,
        POINTER_DOWN: phaserEventNames.pointerDown,
        POINTER_MOVE: phaserEventNames.pointerMove,
        POINTER_UP: phaserEventNames.pointerUp,
        POINTER_UP_OUTSIDE: phaserEventNames.pointerUpOutside,
      },
      Pointer: class Pointer {},
    },
    Scale: {
      Events: {
        RESIZE: phaserEventNames.resize,
      },
    },
    Scene: houseSceneMocks.MockScene,
    Scenes: {
      Events: {
        SHUTDOWN: phaserEventNames.shutdown,
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
  houseSceneMocks.inputs.length = 0;
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

test("preloads and lays out the fullscreen house scene with two interactive cats using the active palette", async () => {
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
  expect(load.image).toHaveBeenNthCalledWith(
    2,
    "cat-shadow-v1",
    "/world/v1/fx/cat-shadow-v1.png",
  );
  expect(load.image).toHaveBeenNthCalledWith(
    3,
    "hover-ring-v1",
    "/world/v1/fx/hover-ring-v1.png",
  );
  expect(load.image).toHaveBeenNthCalledWith(
    4,
    "cat-a-awake-v1",
    "/world/v1/cats/cat-a-awake-v1.png",
  );
  expect(load.image).toHaveBeenNthCalledWith(
    5,
    "cat-b-resting-v1",
    "/world/v1/cats/cat-b-resting-v1.png",
  );
  expect(load.image).toHaveBeenCalledTimes(5);

  scene.create();

  const roomShell = findImage("house-room-shell-v1");
  const ambientShadow = houseSceneMocks.rectangles[0];
  const hoverRingA = findImage("hover-ring-v1", 0);
  const shadowA = findImage("cat-shadow-v1", 0);
  const catA = findImage("cat-a-awake-v1");
  const hoverRingB = findImage("hover-ring-v1", 1);
  const shadowB = findImage("cat-shadow-v1", 1);
  const catB = findImage("cat-b-resting-v1");
  const camera = houseSceneMocks.cameras[0];
  const canvas = houseSceneMocks.canvases[0];
  const scale = houseSceneMocks.scales[0];
  const renderer = houseSceneMocks.renderers[0];
  const events = houseSceneMocks.events[0];
  const input = houseSceneMocks.inputs[0];
  const colorSchemeObserver = MockMutationObserver.instances[0];

  if (
    roomShell === undefined ||
    ambientShadow === undefined ||
    hoverRingA === undefined ||
    shadowA === undefined ||
    catA === undefined ||
    hoverRingB === undefined ||
    shadowB === undefined ||
    catB === undefined ||
    camera === undefined ||
    canvas === undefined ||
    scale === undefined ||
    renderer === undefined ||
    events === undefined ||
    input === undefined ||
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

  expect(scene.add.image).toHaveBeenCalledTimes(7);
  expect(scene.add.image).toHaveBeenNthCalledWith(
    1,
    0,
    0,
    "house-room-shell-v1",
  );
  expect(scene.add.image).toHaveBeenNthCalledWith(2, 560, 714, "hover-ring-v1");
  expect(scene.add.image).toHaveBeenNthCalledWith(3, 560, 714, "cat-shadow-v1");
  expect(scene.add.image).toHaveBeenNthCalledWith(
    4,
    560,
    620,
    "cat-a-awake-v1",
  );
  expect(scene.add.image).toHaveBeenNthCalledWith(5, 332, 824, "hover-ring-v1");
  expect(scene.add.image).toHaveBeenNthCalledWith(6, 332, 824, "cat-shadow-v1");
  expect(scene.add.image).toHaveBeenNthCalledWith(
    7,
    332,
    768,
    "cat-b-resting-v1",
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
  expect(roomShellLayoutCall[0]).toBeCloseTo(1510.4);
  expect(roomShellLayoutCall[1]).toBeCloseTo(1006.9333333333);
  expect(ambientShadowLayoutCall[0]).toBeCloseTo(1510.4);
  expect(ambientShadowLayoutCall[1]).toBeCloseTo(1006.9333333333);
  expect(roomShell.setPosition).toHaveBeenCalledWith(
    755.1999999999999,
    503.46666666666664,
  );
  expect(ambientShadow.setPosition).toHaveBeenCalledWith(
    755.1999999999999,
    503.46666666666664,
  );
  expect(ambientShadow.setFillStyle).toHaveBeenCalledWith(0x120d0b, 0.22);
  expect(hoverRingA.setDepth).toHaveBeenCalledWith(2);
  expect(hoverRingA.setDisplaySize).toHaveBeenLastCalledWith(190.4, 67.2);
  expect(hoverRingA.setPosition).toHaveBeenLastCalledWith(560, 714);
  expect(hoverRingA.visible).toBe(false);
  expect(hoverRingA.alpha).toBe(0.84);
  expect(shadowA.setDepth).toHaveBeenCalledWith(3);
  expect(shadowA.setDisplaySize).toHaveBeenLastCalledWith(170, 60);
  expect(shadowA.setPosition).toHaveBeenLastCalledWith(560, 714);
  expect(shadowA.alpha).toBe(0.56);
  expect(catA.setDepth).toHaveBeenCalledWith(4);
  expect(catA.setDisplaySize).toHaveBeenLastCalledWith(232, 232);
  expect(catA.setPosition).toHaveBeenLastCalledWith(560, 620);
  expect(catA.setInteractive).toHaveBeenCalledTimes(1);
  expect(catA.on).toHaveBeenCalledWith(
    phaserEventNames.gameObjectPointerDown,
    expect.any(Function),
  );
  expect(catA.on).toHaveBeenCalledWith(
    phaserEventNames.gameObjectPointerOver,
    expect.any(Function),
  );
  expect(catA.on).toHaveBeenCalledWith(
    phaserEventNames.gameObjectPointerOut,
    expect.any(Function),
  );
  expect(catA.on).toHaveBeenCalledWith(
    phaserEventNames.gameObjectPointerUp,
    expect.any(Function),
  );
  expect(hoverRingB.setDisplaySize).toHaveBeenLastCalledWith(
    239.68000000000004,
    80.64000000000001,
  );
  expect(hoverRingB.setPosition).toHaveBeenLastCalledWith(332, 824);
  expect(hoverRingB.visible).toBe(false);
  expect(shadowB.setDisplaySize).toHaveBeenLastCalledWith(214, 72);
  expect(shadowB.setPosition).toHaveBeenLastCalledWith(332, 824);
  expect(catB.setDisplaySize).toHaveBeenLastCalledWith(252, 252);
  expect(catB.setPosition).toHaveBeenLastCalledWith(332, 768);
  expect(catB.setInteractive).toHaveBeenCalledTimes(1);
  expect(camera.setBackgroundColor).toHaveBeenCalledWith("#0c0a09");
  expect(camera.setSize).toHaveBeenCalledWith(1280, 720);
  expect(camera.setZoom).toHaveBeenCalledWith(1);
  expect(camera.setViewport).toHaveBeenCalledWith(0, 0, 1280, 720);
  const cameraBoundsCall = camera.setBounds.mock.calls[0];
  const cameraScrollCall = camera.setScroll.mock.calls[0];

  if (cameraBoundsCall === undefined || cameraScrollCall === undefined) {
    throw new Error("Expected the House scene camera to be laid out.");
  }

  expect(cameraBoundsCall[0]).toBe(0);
  expect(cameraBoundsCall[1]).toBe(0);
  expect(cameraBoundsCall[2]).toBeCloseTo(1510.4);
  expect(cameraBoundsCall[3]).toBeCloseTo(1006.9333333333);
  expect(cameraScrollCall[0]).toBeCloseTo(115.2);
  expect(cameraScrollCall[1]).toBeCloseTo(143.4666666667);
  expect(canvas.style.backgroundColor).toBe("#0c0a09");
  expect(canvas.style.cursor).toBe("grab");
  expect(canvas.style.touchAction).toBe("none");
  expect(renderer.config.backgroundColor).toBe("converted:#0c0a09");
  expect(colorSchemeObserver.observe).toHaveBeenCalledWith(
    document.documentElement,
    {
      attributeFilter: ["style"],
      attributes: true,
    },
  );
  expect(input.on).toHaveBeenCalledWith(
    phaserEventNames.pointerDown,
    expect.any(Function),
    scene,
  );
  expect(input.on).toHaveBeenCalledWith(
    phaserEventNames.pointerMove,
    expect.any(Function),
    scene,
  );
  expect(input.on).toHaveBeenCalledWith(
    phaserEventNames.pointerUp,
    expect.any(Function),
    scene,
  );
  expect(input.on).toHaveBeenCalledWith(
    phaserEventNames.pointerUpOutside,
    expect.any(Function),
    scene,
  );
  expect(scale.on).toHaveBeenCalledWith(
    phaserEventNames.resize,
    expect.any(Function),
    scene,
  );
  expect(events.once).toHaveBeenCalledWith(
    phaserEventNames.shutdown,
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
  const hoverRingA = findImage("hover-ring-v1", 0);
  const hoverRingB = findImage("hover-ring-v1", 1);

  if (
    ambientShadow === undefined ||
    camera === undefined ||
    canvas === undefined ||
    renderer === undefined ||
    hoverRingA === undefined ||
    hoverRingB === undefined
  ) {
    throw new Error("Expected the House scene to create its render targets.");
  }

  expect(ambientShadow.setFillStyle).toHaveBeenCalledWith(0x120d0b, 0.22);
  expect(camera.setBackgroundColor).toHaveBeenCalledWith("#0c0a09");
  expect(canvas.style.backgroundColor).toBe("#0c0a09");
  expect(renderer.config.backgroundColor).toBe("converted:#0c0a09");
  expect(hoverRingA.visible).toBe(false);
  expect(hoverRingB.visible).toBe(false);
});

test("shows hover rings, selection state, and pointer cursor for cat interactions", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);

  const { HouseScene } = await import("~/lib/house-scene");
  const scene = new HouseScene();

  scene.preload();
  scene.create();

  const catA = findImage("cat-a-awake-v1");
  const catB = findImage("cat-b-resting-v1");
  const hoverRingA = findImage("hover-ring-v1", 0);
  const hoverRingB = findImage("hover-ring-v1", 1);
  const canvas = houseSceneMocks.canvases[0];

  if (
    catA === undefined ||
    catB === undefined ||
    hoverRingA === undefined ||
    hoverRingB === undefined ||
    canvas === undefined
  ) {
    throw new Error("Expected the cat fixtures to be created.");
  }

  catA.emit(phaserEventNames.gameObjectPointerOver);
  expect(hoverRingA.visible).toBe(true);
  expect(hoverRingA.alpha).toBe(0.84);
  expect(hoverRingB.visible).toBe(false);
  expect(canvas.style.cursor).toBe("pointer");

  const pointerDownEvent = {
    stopPropagation: vi.fn(),
  };
  catA.emit(
    phaserEventNames.gameObjectPointerDown,
    { id: 1 },
    0,
    0,
    pointerDownEvent,
  );
  expect(pointerDownEvent.stopPropagation).toHaveBeenCalledTimes(1);
  expect(canvas.style.cursor).toBe("pointer");

  const pointerUpEvent = {
    stopPropagation: vi.fn(),
  };
  catA.emit(
    phaserEventNames.gameObjectPointerUp,
    { id: 1 },
    0,
    0,
    pointerUpEvent,
  );
  expect(pointerUpEvent.stopPropagation).toHaveBeenCalledTimes(1);
  expect(hoverRingA.visible).toBe(true);
  expect(hoverRingA.alpha).toBe(1);

  catA.emit(phaserEventNames.gameObjectPointerOut);
  expect(hoverRingA.visible).toBe(true);
  expect(canvas.style.cursor).toBe("grab");

  catB.emit(phaserEventNames.gameObjectPointerOver);
  expect(hoverRingA.visible).toBe(true);
  expect(hoverRingB.visible).toBe(true);
  expect(hoverRingB.alpha).toBe(0.84);
  expect(canvas.style.cursor).toBe("pointer");

  catA.emit(phaserEventNames.gameObjectPointerOut);
  expect(hoverRingA.visible).toBe(true);
  expect(hoverRingB.visible).toBe(true);
  expect(canvas.style.cursor).toBe("pointer");

  const pointerUpEventB = {
    stopPropagation: vi.fn(),
  };
  catB.emit(
    phaserEventNames.gameObjectPointerUp,
    { id: 2 },
    0,
    0,
    pointerUpEventB,
  );
  expect(pointerUpEventB.stopPropagation).toHaveBeenCalledTimes(1);
  expect(hoverRingA.visible).toBe(false);
  expect(hoverRingB.visible).toBe(true);
  expect(hoverRingB.alpha).toBe(1);

  catB.emit(phaserEventNames.gameObjectPointerOut);
  expect(hoverRingA.visible).toBe(false);
  expect(hoverRingB.visible).toBe(true);
  expect(canvas.style.cursor).toBe("grab");
});

test("caps zoom on very small viewports so the world stops shrinking past the minimum scale", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);

  const { HouseScene } = await import("~/lib/house-scene");
  const scene = new HouseScene();

  scene.preload();
  scene.create();

  const camera = houseSceneMocks.cameras[0];
  const scale = houseSceneMocks.scales[0];
  const input = houseSceneMocks.inputs[0];
  const pointerDownHandler = input?.on.mock.calls[0]?.[1];
  const pointerMoveHandler = input?.on.mock.calls[1]?.[1];
  const resizeHandler = scale?.on.mock.calls[0]?.[1];

  if (
    camera === undefined ||
    scale === undefined ||
    input === undefined ||
    pointerDownHandler === undefined ||
    pointerMoveHandler === undefined ||
    resizeHandler === undefined
  ) {
    throw new Error("Expected the scene resize callbacks to be registered.");
  }

  scale.width = 640;
  scale.height = 360;
  resizeHandler.call(scene);

  expect(camera.setZoom).toHaveBeenLastCalledWith(0.75);
  const cameraScrollCall = camera.setScroll.mock.calls.at(-1);

  if (cameraScrollCall === undefined) {
    throw new Error("Expected the camera scroll to be updated.");
  }

  expect(cameraScrollCall[0]).toBeCloseTo(435.2);
  expect(cameraScrollCall[1]).toBeCloseTo(323.4666666667);

  pointerDownHandler.call(scene, { id: 9, x: 320, y: 180 });
  pointerMoveHandler.call(scene, { id: 9, x: 260, y: 120 });
  expect(camera.scrollX).toBeCloseTo(515.2);
  expect(camera.scrollY).toBeCloseTo(403.4666666667);
});

test("keeps dragging on mismatched pointer up and safely ignores scroll requests without a world", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);

  const { HouseScene } = await import("~/lib/house-scene");
  const scene = new HouseScene();

  scene.preload();
  scene.create();

  const camera = houseSceneMocks.cameras[0];
  const canvas = houseSceneMocks.canvases[0];
  const scale = houseSceneMocks.scales[0];
  const events = houseSceneMocks.events[0];
  const input = houseSceneMocks.inputs[0];
  const pointerDownHandler = input?.on.mock.calls[0]?.[1];
  const pointerMoveHandler = input?.on.mock.calls[1]?.[1];
  const pointerUpHandler = input?.on.mock.calls[2]?.[1];
  const resizeHandler = scale?.on.mock.calls[0]?.[1];
  const shutdownHandler = events?.once.mock.calls[0]?.[1];

  if (
    camera === undefined ||
    canvas === undefined ||
    scale === undefined ||
    events === undefined ||
    input === undefined ||
    pointerDownHandler === undefined ||
    pointerMoveHandler === undefined ||
    pointerUpHandler === undefined ||
    resizeHandler === undefined ||
    shutdownHandler === undefined
  ) {
    throw new Error("Expected the scene guard callbacks to be registered.");
  }

  pointerDownHandler.call(scene, { id: 11, x: 320, y: 180 });
  pointerUpHandler.call(scene, { id: 12 });
  expect(canvas.style.cursor).toBe("grabbing");

  pointerMoveHandler.call(scene, { id: 11, x: 260, y: 120 });
  expect(camera.scrollX).toBeCloseTo(175.2);
  expect(camera.scrollY).toBeCloseTo(203.4666666667);

  camera.width = 1510.3999999999999;
  camera.height = 1006.9333333333333;
  camera.zoom = 1;
  camera.scrollX = 0;
  camera.scrollY = 0;
  resizeHandler.call(scene);
  expect(camera.scrollX).toBeCloseTo(115.2);
  expect(camera.scrollY).toBeCloseTo(143.4666666667);

  shutdownHandler.call(scene);
  camera.setScroll.mockClear();

  const setCameraScroll = Reflect.get(scene, "setCameraScroll");

  if (typeof setCameraScroll !== "function") {
    throw new Error("Expected the House scene scroll helper to exist.");
  }

  expect(() => {
    setCameraScroll.call(scene, 1, 1);
  }).not.toThrow();
  expect(camera.setScroll).not.toHaveBeenCalled();
});

test("responds to palette changes, resize events, cat callbacks after shutdown, and shutdown cleanup", async () => {
  vi.stubGlobal("MutationObserver", MockMutationObserver);

  const { HouseScene } = await import("~/lib/house-scene");
  const scene = new HouseScene();

  scene.preload();
  scene.create();

  const roomShell = findImage("house-room-shell-v1");
  const ambientShadow = houseSceneMocks.rectangles[0];
  const hoverRingA = findImage("hover-ring-v1", 0);
  const shadowA = findImage("cat-shadow-v1", 0);
  const catA = findImage("cat-a-awake-v1");
  const scale = houseSceneMocks.scales[0];
  const events = houseSceneMocks.events[0];
  const camera = houseSceneMocks.cameras[0];
  const canvas = houseSceneMocks.canvases[0];
  const input = houseSceneMocks.inputs[0];
  const renderer = houseSceneMocks.renderers[0];
  const colorSchemeObserver = MockMutationObserver.instances[0];
  const pointerDownHandler = input?.on.mock.calls[0]?.[1];
  const pointerMoveHandler = input?.on.mock.calls[1]?.[1];
  const pointerUpHandler = input?.on.mock.calls[2]?.[1];
  const resizeHandler = scale?.on.mock.calls[0]?.[1];
  const shutdownHandler = events?.once.mock.calls[0]?.[1];

  if (
    roomShell === undefined ||
    ambientShadow === undefined ||
    hoverRingA === undefined ||
    shadowA === undefined ||
    catA === undefined ||
    scale === undefined ||
    events === undefined ||
    input === undefined ||
    pointerDownHandler === undefined ||
    pointerMoveHandler === undefined ||
    pointerUpHandler === undefined ||
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

  pointerDownHandler.call(scene, { id: 7, x: 300, y: 260 });
  expect(canvas.style.cursor).toBe("grabbing");

  pointerMoveHandler.call(scene, { id: 7, x: 240, y: 200 });
  expect(camera.scrollX).toBeCloseTo(175.2);
  expect(camera.scrollY).toBeCloseTo(203.4666666667);

  pointerMoveHandler.call(scene, { id: 7, x: 700, y: 900 });
  expect(camera.setScroll).toHaveBeenLastCalledWith(0, 0);

  pointerUpHandler.call(scene, { id: 7 });
  expect(canvas.style.cursor).toBe("grab");
  camera.setScroll.mockClear();
  pointerMoveHandler.call(scene, { id: 7, x: 250, y: 250 });
  expect(camera.setScroll).not.toHaveBeenCalled();

  scale.width = 1024;
  scale.height = 600;
  resizeHandler.call(scene);

  expect(camera.setSize).toHaveBeenLastCalledWith(1024, 600);
  expect(camera.setZoom).toHaveBeenLastCalledWith(0.8333333333333334);
  expect(camera.setViewport).toHaveBeenLastCalledWith(0, 0, 1024, 600);
  expect(camera.setBounds).toHaveBeenLastCalledWith(
    0,
    0,
    1510.3999999999999,
    1006.9333333333333,
  );
  expect(camera.setScroll).toHaveBeenLastCalledWith(102.39999999999998, 60);
  expect(ambientShadow.setDisplaySize).toHaveBeenLastCalledWith(
    1510.3999999999999,
    1006.9333333333333,
  );
  expect(ambientShadow.setPosition).toHaveBeenLastCalledWith(
    755.1999999999999,
    503.46666666666664,
  );
  expect(roomShell.setDisplaySize).toHaveBeenLastCalledWith(
    1510.3999999999999,
    1006.9333333333333,
  );
  expect(roomShell.setPosition).toHaveBeenLastCalledWith(
    755.1999999999999,
    503.46666666666664,
  );
  expect(hoverRingA.setDisplaySize).toHaveBeenLastCalledWith(190.4, 67.2);
  expect(hoverRingA.setPosition).toHaveBeenLastCalledWith(560, 714);
  expect(shadowA.setDisplaySize).toHaveBeenLastCalledWith(170, 60);
  expect(shadowA.setPosition).toHaveBeenLastCalledWith(560, 714);
  expect(catA.setDisplaySize).toHaveBeenLastCalledWith(232, 232);
  expect(catA.setPosition).toHaveBeenLastCalledWith(560, 620);

  pointerDownHandler.call(scene, { id: 8, x: 512, y: 300 });
  pointerMoveHandler.call(scene, { id: 8, x: 462, y: 250 });
  expect(camera.scrollX).toBeCloseTo(162.4);
  expect(camera.scrollY).toBeCloseTo(120);

  pointerMoveHandler.call(scene, { id: 8, x: 252, y: 0 });
  expect(camera.scrollX).toBeCloseTo(384);
  expect(camera.scrollY).toBeCloseTo(346.9333333333);

  shutdownHandler.call(scene);

  expect(colorSchemeObserver.disconnect).toHaveBeenCalledTimes(1);
  expect(input.off).toHaveBeenCalledWith(
    phaserEventNames.pointerDown,
    pointerDownHandler,
    scene,
  );
  expect(input.off).toHaveBeenCalledWith(
    phaserEventNames.pointerMove,
    pointerMoveHandler,
    scene,
  );
  expect(input.off).toHaveBeenCalledWith(
    phaserEventNames.pointerUp,
    pointerUpHandler,
    scene,
  );
  expect(input.off).toHaveBeenCalledWith(
    phaserEventNames.pointerUpOutside,
    pointerUpHandler,
    scene,
  );
  expect(scale.off).toHaveBeenCalledWith(
    phaserEventNames.resize,
    resizeHandler,
    scene,
  );
  ambientShadow.setFillStyle.mockClear();
  roomShell.setPosition.mockClear();
  hoverRingA.setVisible.mockClear();
  colorSchemeObserver.notify();
  expect(() => {
    resizeHandler.call(scene);
  }).not.toThrow();
  expect(ambientShadow.setFillStyle).not.toHaveBeenCalled();
  expect(roomShell.setPosition).not.toHaveBeenCalled();
  expect(() => {
    catA.emit(phaserEventNames.gameObjectPointerOver);
  }).not.toThrow();
  expect(hoverRingA.setVisible).not.toHaveBeenCalled();
});
