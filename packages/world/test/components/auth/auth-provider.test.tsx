import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

test("wraps children with the auth provider primitive and mounts the error toaster", async () => {
  vi.doMock("@better-auth-ui/react", () => ({
    AuthProvider: ({
      authClient,
      children,
    }: {
      authClient: unknown;
      children: ReactNode;
    }) => (
      <div
        data-has-auth-client={String(Boolean(authClient))}
        data-testid="auth-provider-primitive"
      >
        {children}
      </div>
    ),
  }));

  vi.doMock("~/components/auth/error-toaster", () => ({
    ErrorToaster: () => <div data-testid="error-toaster" />,
  }));

  const { AuthProvider } = await import("~/components/auth/auth-provider");

  render(
    <AuthProvider authClient={{} as never} navigate={vi.fn()}>
      <span>OpenKitten</span>
    </AuthProvider>,
  );

  expect(screen.getByTestId("auth-provider-primitive")).toHaveAttribute(
    "data-has-auth-client",
    "true",
  );
  expect(screen.getByText("OpenKitten")).toBeInTheDocument();
  expect(screen.getByTestId("error-toaster")).toBeInTheDocument();
});
