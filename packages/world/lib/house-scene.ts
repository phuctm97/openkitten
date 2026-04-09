import Phaser from "phaser";
import { getColorScheme } from "~/lib/get-color-scheme";
import { getHousePalette } from "~/lib/get-house-palette";

type HouseView = {
  awakeCat: Phaser.GameObjects.Image;
  restingCat: Phaser.GameObjects.Image;
  ambientShadow: Phaser.GameObjects.Rectangle;
  roomShell: Phaser.GameObjects.Image;
};

type DragState = {
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  startScrollX: number;
  startScrollY: number;
  startZoom: number;
};

type WorldSize = {
  height: number;
  width: number;
};

type ScrollBounds = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
};

const ambientShadowHeight = 1;
const ambientShadowWidth = 1;
const ambientShadowDepth = 1;
const awakeCatDisplaySizeRatio = 0.26;
const restingCatDisplaySizeRatio = 0.28;
const awakeCatFloorXRatio = 0.36;
const restingCatFloorXRatio = 0.6;
const awakeCatFloorYRatio = 0.71;
const restingCatFloorYRatio = 0.73;
const awakeCatOriginY = 0.95;
const restingCatOriginY = 0.78;
const awakeCatTextureKey = "cat-a-awake-v1";
const restingCatTextureKey = "cat-b-resting-v1";
const awakeCatTexturePath = "/world/v1/cats/cat-a-awake-v1.png";
const restingCatTexturePath = "/world/v1/cats/cat-b-resting-v1.png";
const designViewportHeight = 720;
const designViewportWidth = 1280;
const minimumCameraZoom = 0.75;
const roomShellHeight = 1024;
const roomShellTextureKey = "house-room-shell-v1";
const roomShellTexturePath = "/world/v1/backgrounds/house-room-shell-v1.png";
const roomShellWidth = 1536;
const worldOverscanMultiplier = 1.18;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCoverSize(width: number, height: number) {
  const scale = Math.max(width / roomShellWidth, height / roomShellHeight);

  return {
    displayHeight: roomShellHeight * scale,
    displayWidth: roomShellWidth * scale,
  };
}

function getCameraZoom(width: number, height: number) {
  return Math.max(
    minimumCameraZoom,
    width / designViewportWidth,
    height / designViewportHeight,
  );
}

function getScrollProgress(
  scroll: number,
  minScroll: number,
  maxScroll: number,
) {
  if (maxScroll <= minScroll) {
    return 0.5;
  }

  return clamp((scroll - minScroll) / (maxScroll - minScroll), 0, 1);
}

function getVisibleSize(width: number, height: number, zoom: number) {
  return {
    height: height / zoom,
    width: width / zoom,
  };
}

function getWorldSize(): WorldSize {
  const { displayHeight, displayWidth } = getCoverSize(
    designViewportWidth,
    designViewportHeight,
  );

  return {
    height: displayHeight * worldOverscanMultiplier,
    width: displayWidth * worldOverscanMultiplier,
  };
}

function getCameraScrollBounds(
  worldSize: WorldSize,
  width: number,
  height: number,
  zoom: number,
): ScrollBounds {
  const visibleSize = getVisibleSize(width, height, zoom);
  const minX = (visibleSize.width - width) / 2;
  const minY = (visibleSize.height - height) / 2;

  return {
    maxX: Math.max(minX, minX + worldSize.width - visibleSize.width),
    maxY: Math.max(minY, minY + worldSize.height - visibleSize.height),
    minX,
    minY,
  };
}

function getPositionFromRatios(
  worldSize: WorldSize,
  xRatio: number,
  yRatio: number,
) {
  return {
    x: worldSize.width * xRatio,
    y: worldSize.height * yRatio,
  };
}

function getSquareDisplaySize(worldSize: WorldSize, ratio: number) {
  const size = worldSize.height * ratio;

  return {
    height: size,
    width: size,
  };
}

export class HouseScene extends Phaser.Scene {
  static readonly key = "house";

  private colorSchemeObserver: MutationObserver | null = null;
  private dragState: DragState | null = null;
  private view: HouseView | null = null;
  private worldSize: WorldSize | null = null;

  constructor() {
    super(HouseScene.key);
  }

  preload() {
    this.load.image(roomShellTextureKey, roomShellTexturePath);
    this.load.image(awakeCatTextureKey, awakeCatTexturePath);
    this.load.image(restingCatTextureKey, restingCatTexturePath);
  }

  create() {
    const palette = getHousePalette(getColorScheme());
    const roomShell = this.add.image(0, 0, roomShellTextureKey).setOrigin(0.5);
    const awakeCat = this.add
      .image(0, 0, awakeCatTextureKey)
      .setOrigin(0.5, awakeCatOriginY);
    const restingCat = this.add
      .image(0, 0, restingCatTextureKey)
      .setOrigin(0.5, restingCatOriginY);
    const ambientShadow = this.add
      .rectangle(
        0,
        0,
        ambientShadowWidth,
        ambientShadowHeight,
        palette.ambientShadowColor,
        palette.ambientShadowAlpha,
      )
      .setOrigin(0.5)
      .setDepth(ambientShadowDepth);

    this.view = {
      awakeCat,
      restingCat,
      ambientShadow,
      roomShell,
    };

    this.game.canvas.style.cursor = "grab";
    this.game.canvas.style.touchAction = "none";
    this.syncPalette();
    this.layout();
    this.colorSchemeObserver = new MutationObserver(() => {
      this.syncPalette();
    });
    this.colorSchemeObserver.observe(document.documentElement, {
      attributeFilter: ["style"],
      attributes: true,
    });
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      this.handlePointerDown,
      this,
    );
    this.input.on(
      Phaser.Input.Events.POINTER_MOVE,
      this.handlePointerMove,
      this,
    );
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    this.input.on(
      Phaser.Input.Events.POINTER_UP_OUTSIDE,
      this.handlePointerUp,
      this,
    );
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  private handleResize() {
    this.layout();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    const camera = this.cameras.main;

    this.dragState = {
      pointerId: pointer.id,
      startPointerX: pointer.x,
      startPointerY: pointer.y,
      startScrollX: camera.scrollX,
      startScrollY: camera.scrollY,
      startZoom: camera.zoom,
    };
    this.game.canvas.style.cursor = "grabbing";
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    const dragState = this.dragState;

    if (dragState === null || dragState.pointerId !== pointer.id) {
      return;
    }

    this.setCameraScroll(
      dragState.startScrollX -
        (pointer.x - dragState.startPointerX) / dragState.startZoom,
      dragState.startScrollY -
        (pointer.y - dragState.startPointerY) / dragState.startZoom,
    );
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer) {
    if (this.dragState?.pointerId !== pointer.id) {
      return;
    }

    this.dragState = null;
    this.game.canvas.style.cursor = "grab";
  }

  private handleShutdown() {
    this.colorSchemeObserver?.disconnect();
    this.colorSchemeObserver = null;
    this.dragState = null;
    this.input.off(
      Phaser.Input.Events.POINTER_DOWN,
      this.handlePointerDown,
      this,
    );
    this.input.off(
      Phaser.Input.Events.POINTER_MOVE,
      this.handlePointerMove,
      this,
    );
    this.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    this.input.off(
      Phaser.Input.Events.POINTER_UP_OUTSIDE,
      this.handlePointerUp,
      this,
    );
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.view = null;
    this.worldSize = null;
  }

  private syncPalette() {
    const view = this.view;

    if (view === null) {
      return;
    }

    const palette = getHousePalette(getColorScheme());
    const backgroundColor = Phaser.Display.Color.ValueToColor(
      palette.backgroundColor,
    );

    view.ambientShadow.setFillStyle(
      palette.ambientShadowColor,
      palette.ambientShadowAlpha,
    );
    this.cameras.main.setBackgroundColor(palette.backgroundColor);
    this.game.canvas.style.backgroundColor = palette.backgroundColor;
    Object.assign(this.game.renderer.config, {
      backgroundColor,
    });
  }

  private setCameraScroll(x: number, y: number) {
    const worldSize = this.worldSize;

    if (worldSize === null) {
      return;
    }

    const camera = this.cameras.main;
    const { maxX, maxY, minX, minY } = getCameraScrollBounds(
      worldSize,
      camera.width,
      camera.height,
      camera.zoom,
    );

    camera.setScroll(clamp(x, minX, maxX), clamp(y, minY, maxY));
  }

  private layout() {
    const view = this.view;

    if (view === null) {
      return;
    }

    const camera = this.cameras.main;
    const previousWorldSize = this.worldSize;
    const { height, width } = this.scale;
    const zoom = getCameraZoom(width, height);
    const worldSize = getWorldSize();
    const previousScrollBounds =
      previousWorldSize === null
        ? null
        : getCameraScrollBounds(
            previousWorldSize,
            camera.width,
            camera.height,
            camera.zoom,
          );
    const nextScrollBounds = getCameraScrollBounds(
      worldSize,
      width,
      height,
      zoom,
    );
    const scrollProgressX =
      previousScrollBounds === null
        ? 0.5
        : getScrollProgress(
            camera.scrollX,
            previousScrollBounds.minX,
            previousScrollBounds.maxX,
          );
    const scrollProgressY =
      previousScrollBounds === null
        ? 0.5
        : getScrollProgress(
            camera.scrollY,
            previousScrollBounds.minY,
            previousScrollBounds.maxY,
          );

    this.worldSize = worldSize;
    camera.setSize(width, height);
    camera.setZoom(zoom);
    camera.setViewport(0, 0, width, height);
    camera.setBounds(0, 0, worldSize.width, worldSize.height);
    this.setCameraScroll(
      previousScrollBounds === null
        ? (nextScrollBounds.minX + nextScrollBounds.maxX) / 2
        : nextScrollBounds.minX +
            (nextScrollBounds.maxX - nextScrollBounds.minX) * scrollProgressX,
      previousScrollBounds === null
        ? (nextScrollBounds.minY + nextScrollBounds.maxY) / 2
        : nextScrollBounds.minY +
            (nextScrollBounds.maxY - nextScrollBounds.minY) * scrollProgressY,
    );
    view.ambientShadow.setDisplaySize(worldSize.width, worldSize.height);
    view.ambientShadow.setPosition(worldSize.width / 2, worldSize.height / 2);
    view.roomShell.setDisplaySize(worldSize.width, worldSize.height);
    view.roomShell.setPosition(worldSize.width / 2, worldSize.height / 2);
    const awakeCatPosition = getPositionFromRatios(
      worldSize,
      awakeCatFloorXRatio,
      awakeCatFloorYRatio,
    );
    const restingCatPosition = getPositionFromRatios(
      worldSize,
      restingCatFloorXRatio,
      restingCatFloorYRatio,
    );
    const awakeCatDisplaySize = getSquareDisplaySize(
      worldSize,
      awakeCatDisplaySizeRatio,
    );
    const restingCatDisplaySize = getSquareDisplaySize(
      worldSize,
      restingCatDisplaySizeRatio,
    );

    view.awakeCat.setDisplaySize(
      awakeCatDisplaySize.width,
      awakeCatDisplaySize.height,
    );
    view.awakeCat.setPosition(awakeCatPosition.x, awakeCatPosition.y);
    view.restingCat.setDisplaySize(
      restingCatDisplaySize.width,
      restingCatDisplaySize.height,
    );
    view.restingCat.setPosition(restingCatPosition.x, restingCatPosition.y);
  }
}
