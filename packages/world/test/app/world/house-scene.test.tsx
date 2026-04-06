import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren, ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

import { worldFixture } from "~/lib/world-fixture";

const houseSceneMocks = vi.hoisted(() => ({
  drawCalls: [] as string[],
  extend: vi.fn(),
}));

function createGraphicsRecorder() {
  const recorder = {
    clear() {
      houseSceneMocks.drawCalls.push("clear");
      return recorder;
    },
    roundRect() {
      houseSceneMocks.drawCalls.push("roundRect");
      return recorder;
    },
    rect() {
      houseSceneMocks.drawCalls.push("rect");
      return recorder;
    },
    fill() {
      houseSceneMocks.drawCalls.push("fill");
      return recorder;
    },
    moveTo() {
      houseSceneMocks.drawCalls.push("moveTo");
      return recorder;
    },
    lineTo() {
      houseSceneMocks.drawCalls.push("lineTo");
      return recorder;
    },
    stroke() {
      houseSceneMocks.drawCalls.push("stroke");
      return recorder;
    },
    circle() {
      houseSceneMocks.drawCalls.push("circle");
      return recorder;
    },
    ellipse() {
      houseSceneMocks.drawCalls.push("ellipse");
      return recorder;
    },
    quadraticCurveTo() {
      houseSceneMocks.drawCalls.push("quadraticCurveTo");
      return recorder;
    },
  };

  return recorder;
}

vi.mock("pixi.js", () => ({
  Container: class Container {},
  Graphics: class Graphics {},
}));

vi.mock("@pixi/react", async () => {
  const react = await vi.importActual<typeof import("react")>("react");

  const visitNode = (node: ReactNode) => {
    if (Array.isArray(node)) {
      for (const child of node) {
        visitNode(child);
      }

      return;
    }

    if (
      !react.isValidElement<{
        children?: ReactNode;
        draw?: (graphics: ReturnType<typeof createGraphicsRecorder>) => void;
        onPointerTap?: () => void;
      }>(node)
    ) {
      return;
    }

    if (typeof node.props.draw === "function") {
      node.props.draw(createGraphicsRecorder());
    }

    if (typeof node.props.onPointerTap === "function") {
      node.props.onPointerTap();
    }

    visitNode(node.props.children);
  };

  return {
    extend: houseSceneMocks.extend,
    Application({
      children,
      ...props
    }: PropsWithChildren<Record<string, unknown>>) {
      visitNode(children);

      return react.createElement("div", props, children);
    },
  };
});

afterEach(() => {
  houseSceneMocks.drawCalls = [];
  houseSceneMocks.extend.mockClear();
});

test("renders house hotspots, reaction text, and executes Pixi draw callbacks", async () => {
  const user = userEvent.setup();
  const onShowCat = vi.fn();
  const onShowInbox = vi.fn();
  const onShowWhiteboard = vi.fn();
  const onShowCabinet = vi.fn();
  const onShowThread = vi.fn();
  const { HouseScene } = await import("~/app/world/house-scene");

  render(
    <HouseScene
      onShowCabinet={onShowCabinet}
      onShowCat={onShowCat}
      onShowInbox={onShowInbox}
      onShowThread={onShowThread}
      onShowWhiteboard={onShowWhiteboard}
      reactionMessage="Pricing review for launch page stirred the room."
      spotlightCatId="cat-mochi"
      spotlightThreadId="thread-pricing"
      unreadNoticeCount={2}
      world={worldFixture}
      worldClock={3}
    />,
  );

  expect(
    screen.getByText("Pricing review for launch page stirred the room."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Inbox 2 waiting/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Mochi Planning desk/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Pepper Window nook/i }),
  ).toBeInTheDocument();
  expect(houseSceneMocks.extend).toHaveBeenCalledTimes(1);
  expect(houseSceneMocks.drawCalls).toContain("quadraticCurveTo");

  await user.click(screen.getByRole("button", { name: /Inbox 2 waiting/i }));
  await user.click(
    screen.getByRole("button", { name: /House whiteboard House cues/i }),
  );
  await user.click(
    screen.getByRole("button", { name: /Reference cabinet Shared files/i }),
  );
  await user.click(
    screen.getByRole("button", { name: /Mochi Planning desk/i }),
  );
  await user.click(screen.getByRole("button", { name: /Pepper Window nook/i }));
  await user.click(
    screen.getByRole("button", { name: /Active thread Pricing review/i }),
  );

  expect(onShowInbox).toHaveBeenCalledTimes(2);
  expect(onShowWhiteboard).toHaveBeenCalledTimes(2);
  expect(onShowCabinet).toHaveBeenCalledTimes(2);
  expect(onShowCat).toHaveBeenNthCalledWith(1, "cat-mochi");
  expect(onShowCat).toHaveBeenNthCalledWith(2, "cat-pepper");
  expect(onShowCat).toHaveBeenNthCalledWith(3, "cat-mochi");
  expect(onShowCat).toHaveBeenNthCalledWith(4, "cat-pepper");
  expect(onShowThread).toHaveBeenNthCalledWith(1, "thread-pricing");
  expect(onShowThread).toHaveBeenNthCalledWith(2, "thread-onboarding");
  expect(onShowThread).toHaveBeenNthCalledWith(3, "thread-pricing");
});

test("falls back cleanly when the room is quiet and cats are omitted", async () => {
  const { HouseScene } = await import("~/app/world/house-scene");
  const quietWorld = {
    ...worldFixture,
    cats: [],
  };

  render(
    <HouseScene
      onShowCabinet={vi.fn()}
      onShowCat={vi.fn()}
      onShowInbox={vi.fn()}
      onShowThread={vi.fn()}
      onShowWhiteboard={vi.fn()}
      reactionMessage={null}
      spotlightCatId={null}
      spotlightThreadId="thread-onboarding"
      unreadNoticeCount={0}
      world={quietWorld}
      worldClock={0}
    />,
  );

  expect(
    screen.getByText(
      "The room stays calm until you inspect something or leave a note.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Mochi/i }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Pepper/i }),
  ).not.toBeInTheDocument();
});
