import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { AuthProvider, useAuth } from "~/components/auth/auth-provider";

function AuthProbe() {
  const auth = useAuth();

  return (
    <a data-testid="auth-probe" href={auth.redirectTo}>
      {auth.basePaths.auth}
    </a>
  );
}

function LinkProbe() {
  const auth = useAuth();

  return (
    <auth.Link data-testid="auth-link" href="/library">
      Library
    </auth.Link>
  );
}

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

test("merges config and reads redirectTo from the current url", () => {
  window.history.replaceState({}, "", "/?redirectTo=%2Fcastle");

  render(
    <AuthProvider
      authClient={{} as never}
      basePaths={{ auth: "/auth", settings: "/settings" }}
      navigate={vi.fn()}
      redirectTo="/play"
    >
      <AuthProbe />
    </AuthProvider>,
  );

  expect(screen.getByTestId("auth-probe")).toHaveAttribute("href", "/castle");
  expect(screen.getByTestId("auth-probe")).toHaveTextContent("/auth");
});

test("uses the surrounding query client when one is already provided", () => {
  const queryClient = new QueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider authClient={{} as never} navigate={vi.fn()}>
        <AuthProbe />
      </AuthProvider>
    </QueryClientProvider>,
  );

  expect(screen.getByTestId("auth-probe")).toHaveAttribute("href", "/");
});

test("provides the default Link renderer when no custom Link is supplied", () => {
  render(
    <AuthProvider authClient={{} as never} navigate={vi.fn()}>
      <LinkProbe />
    </AuthProvider>,
  );

  expect(screen.getByTestId("auth-link")).toHaveAttribute("href", "/library");
  expect(screen.getByTestId("auth-link")).toHaveTextContent("Library");
});

test("throws when useAuth is called outside the provider", () => {
  expect(() => render(<AuthProbe />)).toThrow(
    "[Better Auth UI] AuthProvider is required",
  );
});
