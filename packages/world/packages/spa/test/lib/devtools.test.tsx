import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: () => <div>React Query Devtools</div>,
}));

afterEach(() => {
  vi.resetModules();
});

test("renders react query devtools", async () => {
  const { Devtools } = await import("~/lib/devtools");

  render(<Devtools />);

  expect(await screen.findByText("React Query Devtools")).toBeInTheDocument();
});
