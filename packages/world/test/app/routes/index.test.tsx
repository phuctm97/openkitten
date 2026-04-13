import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("renders the home route with links to app and game", async () => {
  const { default: Component } = await import("~/app/routes/index");

  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );

  expect(screen.getByText("OpenKitten")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Go to /app" })).toHaveAttribute(
    "href",
    "/app",
  );
  expect(screen.getByRole("link", { name: "Go to /game" })).toHaveAttribute(
    "href",
    "/game",
  );
  expect(
    screen.getByRole("button", { name: "System theme" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("main")).toHaveClass("grid", "min-h-screen");
});
