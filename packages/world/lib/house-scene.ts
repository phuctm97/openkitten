import Phaser from "phaser";
import { getColorScheme } from "~/lib/get-color-scheme";
import { getHousePalette } from "~/lib/get-house-palette";

type HouseView = {
  ambientShadow: Phaser.GameObjects.Rectangle;
  roomShell: Phaser.GameObjects.Image;
};

type DragState = {
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  startScrollX: number;
  startScrollY: number;
};

type WorldSize = {
  height: number;
  width: number;
};

const ambientShadowHeight = 1;
const ambientShadowWidth = 1;
const designViewportHeight = 720;
const designViewportWidth = 1280;
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

function getDefaultScroll(maxScroll: number) {
  return maxScroll / 2;
}

function getCameraZoom(width: number, height: number) {
  return Math.max(width / designViewportWidth, height / designViewportHeight);
}

function getScrollProgress(scroll: number, maxScroll: number) {
  if (maxScroll <= 0) {
    return 0.5;
  }

  return clamp(scroll / maxScroll, 0, 1);
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
  }

  create() {
    const palette = getHousePalette(getColorScheme());
    const roomShell = this.add.image(0, 0, roomShellTextureKey).setOrigin(0.5);
    const ambientShadow = this.add
      .rectangle(
        0,
        0,
        ambientShadowWidth,
        ambientShadowHeight,
        palette.ambientShadowColor,
        palette.ambientShadowAlpha,
      )
      .setOrigin(0.5);

    this.view = {
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
    };
    this.game.canvas.style.cursor = "grabbing";
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    const dragState = this.dragState;

    if (dragState === null || dragState.pointerId !== pointer.id) {
      return;
    }

    this.setCameraScroll(
      dragState.startScrollX - (pointer.x - dragState.startPointerX),
      dragState.startScrollY - (pointer.y - dragState.startPointerY),
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
    const { height, width } = getVisibleSize(
      camera.width,
      camera.height,
      camera.zoom,
    );
    const maxScrollX = Math.max(worldSize.width - width, 0);
    const maxScrollY = Math.max(worldSize.height - height, 0);

    camera.setScroll(clamp(x, 0, maxScrollX), clamp(y, 0, maxScrollY));
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
    const previousVisibleSize = getVisibleSize(
      camera.width,
      camera.height,
      camera.zoom,
    );
    const visibleSize = getVisibleSize(width, height, zoom);
    const previousMaxScrollX =
      previousWorldSize === null
        ? 0
        : Math.max(previousWorldSize.width - previousVisibleSize.width, 0);
    const previousMaxScrollY =
      previousWorldSize === null
        ? 0
        : Math.max(previousWorldSize.height - previousVisibleSize.height, 0);
    const scrollProgressX =
      previousWorldSize === null
        ? 0.5
        : getScrollProgress(camera.scrollX, previousMaxScrollX);
    const scrollProgressY =
      previousWorldSize === null
        ? 0.5
        : getScrollProgress(camera.scrollY, previousMaxScrollY);
    const maxScrollX = Math.max(worldSize.width - visibleSize.width, 0);
    const maxScrollY = Math.max(worldSize.height - visibleSize.height, 0);

    this.worldSize = worldSize;
    camera.setSize(width, height);
    camera.setZoom(zoom);
    camera.setViewport(0, 0, width, height);
    camera.setBounds(0, 0, worldSize.width, worldSize.height);
    this.setCameraScroll(
      previousWorldSize === null
        ? getDefaultScroll(maxScrollX)
        : maxScrollX * scrollProgressX,
      previousWorldSize === null
        ? getDefaultScroll(maxScrollY)
        : maxScrollY * scrollProgressY,
    );
    view.ambientShadow.setDisplaySize(worldSize.width, worldSize.height);
    view.ambientShadow.setPosition(worldSize.width / 2, worldSize.height / 2);
    view.roomShell.setDisplaySize(worldSize.width, worldSize.height);
    view.roomShell.setPosition(worldSize.width / 2, worldSize.height / 2);
  }
}
