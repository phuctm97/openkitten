import { render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const destroy = vi.fn();
const createAmbientGame = vi.fn(() => ({ destroy }));

vi.mock("~/lib/create-ambient-game", () => ({ createAmbientGame }));

afterEach(() => {
  createAmbientGame.mockClear();
  destroy.mockClear();
});

test("creates the ambient game on mount and destroys it on unmount", async () => {
  const { AmbientHouseCanvas } = await import("~/lib/ambient-house-canvas");
  const { unmount } = render(<AmbientHouseCanvas />);
  expect(createAmbientGame).toHaveBeenCalledTimes(1);
  unmount();
  expect(destroy).toHaveBeenCalledWith(true);
});

test("applies the className when provided", async () => {
  const { AmbientHouseCanvas } = await import("~/lib/ambient-house-canvas");
  const { container } = render(<AmbientHouseCanvas className="custom" />);
  const root = container.querySelector('[data-testid="ambient-house-canvas"]');
  expect(root?.className).toContain("custom");
});
