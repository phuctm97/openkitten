import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { expect, test, vi } from "vitest";

vi.mock("react-router", async () => {
  const react = await vi.importActual<typeof import("react")>("react");

  return {
    Link: ({
      children,
      to,
      ...props
    }: ComponentProps<"a"> & { children: ReactNode; to: string }) =>
      react.createElement("a", { ...props, href: to }, children),
  };
});

test("maps Better Auth UI href links to React Router links", async () => {
  const { AuthLink } = await import("~/components/auth/auth-link");

  render(
    <AuthLink className="auth-link" href="/auth/sign-in">
      Sign in
    </AuthLink>,
  );

  const link = screen.getByRole("link", { name: "Sign in" });

  expect(link).toHaveAttribute("href", "/auth/sign-in");
  expect(link).toHaveClass("auth-link");
});

test("prefers an explicit React Router target when provided", async () => {
  const { AuthLink } = await import("~/components/auth/auth-link");

  render(
    <AuthLink href="/auth/sign-in" to="/auth/sign-up">
      Sign up
    </AuthLink>,
  );

  expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
    "href",
    "/auth/sign-up",
  );
});
