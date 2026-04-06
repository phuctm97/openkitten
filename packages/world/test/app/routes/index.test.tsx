import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

vi.mock("~/components/scene", () => ({
  Scene: () => <div data-testid="scene-mock">Scene Mock</div>,
}));

import Component from "~/app/routes/index";

test("renders the phase 1 shell without extra status cards", () => {
  render(<Component />);

  expect(screen.getByText("OpenKitten World")).toBeInTheDocument();
  expect(
    screen.getByText(
      "The home page is now a real browser-client demo: React Router drives shell, Jotai powers state, and a Pixi room sits at the center like a tiny screen inside the app.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("Phase 1")).toBeInTheDocument();
  expect(screen.getByText("React + Pixi")).toBeInTheDocument();
  expect(screen.getByText("Theme")).toBeInTheDocument();
  expect(screen.getByTestId("scene-mock")).toBeInTheDocument();
  expect(screen.queryByText("state")).not.toBeInTheDocument();
  expect(screen.queryByText("system")).not.toBeInTheDocument();
  expect(screen.queryByText("stack")).not.toBeInTheDocument();
});

test("switches between auto, light, and dark themes", async () => {
  const user = userEvent.setup();

  render(<Component />);

  await user.click(screen.getByRole("button", { name: "Light theme" }));

  expect(localStorage.getItem("openkitten-world-theme")).toBe("light");

  await user.click(screen.getByRole("button", { name: "Dark theme" }));

  expect(localStorage.getItem("openkitten-world-theme")).toBe("dark");

  await user.click(screen.getByRole("button", { name: "System theme" }));

  expect(localStorage.getItem("openkitten-world-theme")).toBe("auto");
});
