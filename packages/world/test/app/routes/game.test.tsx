import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const gameRouteMocks = vi.hoisted(() => ({
  createGame: vi.fn(() => ({
    destroy: vi.fn(),
  })),
}));

vi.mock("~/lib/create-game", () => ({
  createGame: gameRouteMocks.createGame,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("renders the fullscreen game route and creates Phaser", async () => {
  const { default: Component } = await import("~/app/routes/game");
  const { unmount } = render(<Component />);

  const screenElement = screen.getByTestId("game");

  expect(screenElement).toHaveClass("h-full", "overflow-hidden");
  await waitFor(() => {
    expect(gameRouteMocks.createGame).toHaveBeenCalledTimes(1);
  });
  expect(gameRouteMocks.createGame).toHaveBeenCalledWith(screenElement);
  expect(screen.queryByText("OpenKitten")).not.toBeInTheDocument();
  expect(screen.queryByText("Phase 1")).not.toBeInTheDocument();

  const game = gameRouteMocks.createGame.mock.results[0]?.value;

  if (game === undefined) {
    throw new Error("Expected the Phaser game instance to be created.");
  }

  unmount();

  expect(game.destroy).toHaveBeenCalledWith(true);
});

test("does not create Phaser when the route ref stays null", async () => {
  vi.doMock("react", async () => {
    const react = await vi.importActual<typeof import("react")>("react");

    return {
      ...react,
      useState: () => [null, vi.fn()] as const,
    };
  });

  const { default: NullRefComponent } = await import("~/app/routes/game");

  render(<NullRefComponent />);

  expect(gameRouteMocks.createGame).not.toHaveBeenCalled();
});
