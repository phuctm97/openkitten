import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, expect, test, vi } from "vitest";

import { setupBetterAuthUiMocks } from "~/test/components/auth/mock-better-auth-ui";

function mockAuthChildren() {
  vi.doMock("~/components/auth/forgot-password", () => ({
    ForgotPassword: ({ className }: { className?: string }) => (
      <div data-testid="forgot-password" data-class-name={className} />
    ),
  }));

  vi.doMock("~/components/auth/magic-link", () => ({
    MagicLink: ({
      className,
      socialLayout,
      socialPosition,
    }: {
      className?: string;
      socialLayout?: string;
      socialPosition?: string;
    }) => (
      <div
        data-testid="magic-link"
        data-class-name={className}
        data-social-layout={socialLayout}
        data-social-position={socialPosition}
      />
    ),
  }));

  vi.doMock("~/components/auth/reset-password", () => ({
    ResetPassword: ({ className }: { className?: string }) => (
      <div data-testid="reset-password" data-class-name={className} />
    ),
  }));

  vi.doMock("~/components/auth/sign-in", () => ({
    SignIn: ({
      className,
      socialLayout,
      socialPosition,
    }: {
      className?: string;
      socialLayout?: string;
      socialPosition?: string;
    }) => (
      <div
        data-testid="sign-in"
        data-class-name={className}
        data-social-layout={socialLayout}
        data-social-position={socialPosition}
      />
    ),
  }));

  vi.doMock("~/components/auth/sign-out", () => ({
    SignOut: ({ className }: { className?: string }) => (
      <div data-testid="sign-out" data-class-name={className} />
    ),
  }));

  vi.doMock("~/components/auth/sign-up", () => ({
    SignUp: ({
      className,
      socialLayout,
      socialPosition,
    }: {
      className?: string;
      socialLayout?: string;
      socialPosition?: string;
    }) => (
      <div
        data-testid="sign-up"
        data-class-name={className}
        data-social-layout={socialLayout}
        data-social-position={socialPosition}
      />
    ),
  }));
}

async function loadAuthRouterComponent() {
  const module = await import("~/components/auth/auth-router");

  return module.AuthRouter;
}

beforeEach(() => {
  vi.resetModules();
});

test("throws when neither view nor path is provided", async () => {
  setupBetterAuthUiMocks();
  mockAuthChildren();

  const AuthRouter = await loadAuthRouterComponent();

  expect(() => render(<AuthRouter />)).toThrow(
    "[Better Auth UI] Either `view` or `path` must be provided",
  );
});

test("renders the sign-in view from an explicit view prop", async () => {
  setupBetterAuthUiMocks();
  mockAuthChildren();

  const AuthRouter = await loadAuthRouterComponent();

  render(
    <AuthRouter
      className="auth-card"
      view="signIn"
      socialLayout="grid"
      socialPosition="top"
    />,
  );

  expect(screen.getByTestId("sign-in")).toHaveAttribute(
    "data-class-name",
    "auth-card",
  );
  expect(screen.getByTestId("sign-in")).toHaveAttribute(
    "data-social-layout",
    "grid",
  );
  expect(screen.getByTestId("sign-in")).toHaveAttribute(
    "data-social-position",
    "top",
  );
});

test("prefers an explicit view over a conflicting path", async () => {
  const mocks = setupBetterAuthUiMocks();
  mockAuthChildren();

  const AuthRouter = await loadAuthRouterComponent();

  render(
    <AuthRouter
      path={mocks.auth.viewPaths.auth.signUp}
      socialLayout="vertical"
      socialPosition="bottom"
      view="signOut"
    />,
  );

  expect(screen.getByTestId("sign-out")).toBeInTheDocument();
  expect(screen.queryByTestId("sign-up")).toBeNull();
});

test("resolves the sign-up view from the current auth path", async () => {
  const mocks = setupBetterAuthUiMocks();
  mockAuthChildren();

  const AuthRouter = await loadAuthRouterComponent();

  render(
    <AuthRouter
      className="auth-card"
      path={mocks.auth.viewPaths.auth.signUp}
      socialLayout="vertical"
      socialPosition="bottom"
    />,
  );

  expect(screen.getByTestId("sign-up")).toHaveAttribute(
    "data-class-name",
    "auth-card",
  );
  expect(screen.getByTestId("sign-up")).toHaveAttribute(
    "data-social-layout",
    "vertical",
  );
  expect(screen.getByTestId("sign-up")).toHaveAttribute(
    "data-social-position",
    "bottom",
  );
});

test("renders the remaining auth views", async () => {
  const mocks = setupBetterAuthUiMocks();
  mockAuthChildren();

  const AuthRouter = await loadAuthRouterComponent();

  const scenarios: Array<ComponentProps<typeof AuthRouter>> = [
    {
      className: "magic",
      path: mocks.auth.viewPaths.auth.magicLink,
      socialLayout: "auto",
      socialPosition: "bottom",
    },
    {
      className: "forgot",
      path: mocks.auth.viewPaths.auth.forgotPassword,
    },
    {
      className: "reset",
      path: mocks.auth.viewPaths.auth.resetPassword,
    },
    {
      className: "sign-out",
      path: mocks.auth.viewPaths.auth.signOut,
    },
  ];

  const expectedTestIds = [
    "magic-link",
    "forgot-password",
    "reset-password",
    "sign-out",
  ];

  scenarios.forEach((props, index) => {
    const { unmount } = render(<AuthRouter {...props} />);

    expect(
      screen.getByTestId(expectedTestIds[index] ?? ""),
    ).toBeInTheDocument();

    unmount();
  });
});

test("throws when the resolved auth view is invalid", async () => {
  setupBetterAuthUiMocks({
    auth: {
      viewPaths: {
        auth: {
          forgotPassword: "forgot-password",
          magicLink: "magic-link",
          resetPassword: "reset-password",
          signIn: "sign-in",
          signOut: "sign-out",
          signUp: "sign-up",
        },
      },
    },
  });
  mockAuthChildren();

  const AuthRouter = await loadAuthRouterComponent();

  expect(() => render(<AuthRouter path="unknown" />)).toThrow(
    "[Better Auth UI] Valid views are: forgotPassword, magicLink, resetPassword, signIn, signOut, signUp",
  );
});
