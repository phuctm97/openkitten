import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/",
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useLocation: () => ({ pathname: mocks.pathname }),
    Link: ({ to, children, ...rest }: { to: string } & ComponentProps<"a">) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  };
});

vi.mock("motion/react", () => ({
  motion: {
    div: ({
      children,
      ...rest
    }: { children?: ReactNode } & Record<string, unknown>) => (
      <div data-testid="motion-active" {...(rest as ComponentProps<"div">)}>
        {children}
      </div>
    ),
  },
}));

afterEach(() => {
  mocks.pathname = "/";
});

test("highlights the Home link on the root path", async () => {
  mocks.pathname = "/";
  const { ModeSwitcher } = await import("~/lib/mode-switcher");
  render(<ModeSwitcher />);
  const indicators = screen.getAllByTestId("motion-active");
  expect(indicators).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
    "href",
    "/",
  );
});

test("highlights App mode on /app and nested /app/* paths", async () => {
  mocks.pathname = "/app/cats";
  const { ModeSwitcher } = await import("~/lib/mode-switcher");
  render(<ModeSwitcher />);
  expect(screen.getByRole("link", { name: "App mode" })).toHaveAttribute(
    "href",
    "/app",
  );
});

test("highlights Game mode on /game and nested /game/* paths", async () => {
  mocks.pathname = "/game";
  const { ModeSwitcher } = await import("~/lib/mode-switcher");
  render(<ModeSwitcher />);
  expect(screen.getByRole("link", { name: "Game mode" })).toHaveAttribute(
    "href",
    "/game",
  );
});

test("renders all mode links when on an unrelated path", async () => {
  mocks.pathname = "/settings/account";
  const { ModeSwitcher } = await import("~/lib/mode-switcher");
  render(<ModeSwitcher />);
  expect(screen.queryByTestId("motion-active")).toBeNull();
  expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "App mode" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Game mode" })).toBeInTheDocument();
});
