import { render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

type GraphicsDraw = (graphics: unknown) => void;

type PixiGraphicsElement = ReactElement<{
  draw: GraphicsDraw;
}>;

type PixiContainerElement = ReactElement<{
  children: PixiGraphicsElement;
}>;

const sceneMocks = vi.hoisted(() => ({
  application: vi.fn(
    (props: { children?: ReactNode } & Record<string, unknown>) => (
      <div data-testid="pixi-application">{props.children}</div>
    ),
  ),
  drawScene: vi.fn(),
  extend: vi.fn(),
}));

vi.mock("@pixi/react", () => ({
  Application: sceneMocks.application,
  extend: sceneMocks.extend,
}));

vi.mock("pixi.js", () => ({
  Container: class Container {},
  Graphics: class Graphics {},
}));

vi.mock("~/lib/draw-scene", () => ({
  drawScene: sceneMocks.drawScene,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

test("renders the scene shell and boots the pixi application", async () => {
  const { Scene } = await import("~/components/scene");
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  render(<Scene />);

  expect(screen.getByTestId("scene")).toBeInTheDocument();
  expect(screen.getByText("World Screen")).toBeInTheDocument();
  expect(screen.getByText("Phase 1")).toBeInTheDocument();
  expect(screen.getByText("two cats / one room")).toBeInTheDocument();
  expect(await screen.findByTestId("pixi-application")).toBeInTheDocument();
  expect(sceneMocks.application).toHaveBeenCalledTimes(1);
  expect(sceneMocks.extend).toHaveBeenCalledWith({
    Container: expect.any(Function),
    Graphics: expect.any(Function),
  });

  const applicationProps = sceneMocks.application.mock.calls[0]?.[0];
  const containerElement = applicationProps?.["children"] as
    | PixiContainerElement
    | undefined;

  if (containerElement === undefined) {
    throw new Error("Expected the Pixi container element to be rendered.");
  }

  const graphicsElement = containerElement.props.children;
  const draw = graphicsElement.props.draw;

  expect(applicationProps?.["antialias"]).toBe(true);
  expect(applicationProps?.["autoDensity"]).toBe(true);
  expect(applicationProps?.["backgroundAlpha"]).toBe(0);
  expect(applicationProps?.["className"]).toBe("absolute inset-0 size-full");
  expect(applicationProps?.["height"]).toBe(800);
  expect(applicationProps?.["width"]).toBe(1280);

  vi.stubGlobal("performance", { now: () => 2500 });

  draw({ clear: vi.fn() });

  expect(sceneMocks.drawScene).toHaveBeenCalledWith(
    expect.objectContaining({ clear: expect.any(Function) }),
    1280,
    800,
    2.5,
  );

  errorSpy.mockRestore();
});
