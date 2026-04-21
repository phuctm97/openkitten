import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Route } from "~/.react-router/types/app/routes/+types/auth";

const authRouteMocks = vi.hoisted(() => ({
  authRouter: vi.fn((props: { path: string }) => (
    <div data-path={props.path}>Auth Router</div>
  )),
}));

vi.mock("~/components/auth/auth-router", () => ({
  AuthRouter: (props: { path: string }) => authRouteMocks.authRouter(props),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("renders the auth route for the current auth path", async () => {
  const { default: Component } = await import("~/app/routes/auth");
  const authComponentProps = {
    loaderData: undefined,
    matches: [
      {
        id: "root",
        params: { path: "forgot-password" },
        pathname: "/auth/forgot-password",
        data: undefined,
        loaderData: undefined,
        handle: undefined,
      },
      {
        id: "routes/auth",
        params: { path: "forgot-password" },
        pathname: "/auth/forgot-password",
        data: undefined,
        loaderData: undefined,
        handle: undefined,
      },
    ],
    params: { path: "forgot-password" },
  } satisfies Route.ComponentProps;

  render(<Component {...authComponentProps} />);

  expect(authRouteMocks.authRouter).toHaveBeenCalledWith({
    path: "forgot-password",
  });
  expect(screen.getByRole("main")).toHaveClass("grid", "min-h-screen");
});
