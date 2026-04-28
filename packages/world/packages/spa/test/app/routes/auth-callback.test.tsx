import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const authCallbackRouteMocks = vi.hoisted(() => ({
  consumeCallback: vi.fn(),
  getSession: vi.fn(),
  replace: vi.fn((to: string) => {
    return new Response(null, {
      headers: { Location: to },
      status: 302,
    });
  }),
}));

vi.mock("react-router", () => ({
  replace: authCallbackRouteMocks.replace,
}));

vi.mock("~/lib/consume-callback", () => ({
  consumeCallback: authCallbackRouteMocks.consumeCallback,
}));

vi.mock("~/lib/get-session", () => ({
  getSession: authCallbackRouteMocks.getSession,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("redirects to sign-in when no session exists", async () => {
  authCallbackRouteMocks.getSession.mockResolvedValue(null);

  const { clientLoader } = await import("~/app/routes/auth-callback");

  await expect(clientLoader()).rejects.toMatchObject({ status: 302 });
  expect(authCallbackRouteMocks.replace).toHaveBeenCalledWith("/auth/sign-in");
});

test("redirects to verify-email when the session is unverified", async () => {
  authCallbackRouteMocks.getSession.mockResolvedValue({
    user: { id: "user-1", emailVerified: false },
  });

  const { clientLoader } = await import("~/app/routes/auth-callback");

  await expect(clientLoader()).rejects.toMatchObject({ status: 302 });
  expect(authCallbackRouteMocks.replace).toHaveBeenCalledWith(
    "/auth/verify-email",
  );
});

test("redirects to the consumed callback when verified", async () => {
  authCallbackRouteMocks.getSession.mockResolvedValue({
    user: { id: "user-1", emailVerified: true },
  });
  authCallbackRouteMocks.consumeCallback.mockReturnValue("/app?tab=home");

  const { clientLoader } = await import("~/app/routes/auth-callback");

  await expect(clientLoader()).rejects.toMatchObject({ status: 302 });
  expect(authCallbackRouteMocks.replace).toHaveBeenCalledWith("/app?tab=home");
});

test("renders a loading state while transitioning", async () => {
  const { default: Component } = await import("~/app/routes/auth-callback");

  render(<Component />);

  expect(screen.getByRole("status")).toBeInTheDocument();
});
