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
      "The home page now pulls from one fixed House scenario. Mochi is awake, Pepper is keeping watch, and the world shell has stable cats, threads, notices, and a running transcript ready for the next slice.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("Phase 2")).toBeInTheDocument();
  expect(screen.getByText("Fixture-driven House")).toBeInTheDocument();
  expect(screen.getByText("Lantern House")).toBeInTheDocument();
  expect(screen.getByText("Mochi")).toBeInTheDocument();
  expect(screen.getByText("Pepper")).toBeInTheDocument();
  expect(
    screen.getByText("Draft the first readable session panel flow"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Mochi asked for a quick panel-flow review"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Drafting a fixture-driven overview so the next phase can open real panels without rewriting the story.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByTestId("scene-mock")).toBeInTheDocument();
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
