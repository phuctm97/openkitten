import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("renders the app route greeting", async () => {
  const { default: Component } = await import("~/app/routes/app");

  render(<Component />);

  expect(screen.getByText("Hello, world!")).toBeInTheDocument();
  expect(screen.getByRole("main")).toHaveClass("grid", "min-h-screen");
});
