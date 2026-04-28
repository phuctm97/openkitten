import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

const appRouteMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("@better-auth-ui/react", () => ({
  useSession: appRouteMocks.useSession,
}));

afterEach(() => {
  appRouteMocks.useSession.mockReset();
  vi.resetModules();
});

test("renders the app route greeting and sign-out link when signed in", async () => {
  appRouteMocks.useSession.mockReturnValue({
    data: {
      user: {
        id: "user-1",
      },
    },
  });

  const { default: Component } = await import("~/app/routes/app");

  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );

  expect(screen.getByText("Hello, world!")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Sign out" })).toHaveAttribute(
    "href",
    "/auth/sign-out",
  );
  expect(screen.getByRole("main")).toHaveClass("grid", "min-h-screen");
});

test("does not render the sign-out link when signed out", async () => {
  appRouteMocks.useSession.mockReturnValue({
    data: null,
  });

  const { default: Component } = await import("~/app/routes/app");

  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );

  expect(screen.getByText("Hello, world!")).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Sign out" }),
  ).not.toBeInTheDocument();
});
