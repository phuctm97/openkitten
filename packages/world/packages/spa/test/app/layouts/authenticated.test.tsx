import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const authenticatedLayoutMocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  outlet: vi.fn(() => <div data-testid="protected-route" />),
  useAuthenticate: vi.fn(),
}));

vi.mock("@better-auth-ui/react", () => ({
  useAuthenticate: authenticatedLayoutMocks.useAuthenticate,
}));

vi.mock("react-router", () => ({
  Outlet: () => authenticatedLayoutMocks.outlet(),
}));

vi.mock("~/lib/authenticate", () => ({
  authenticate: authenticatedLayoutMocks.authenticate,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("renders protected route content when authenticated", async () => {
  authenticatedLayoutMocks.useAuthenticate.mockReturnValue({
    data: {
      user: {
        id: "user-1",
      },
    },
  });

  const { default: Component } = await import("~/app/layouts/authenticated");

  render(<Component />);

  expect(screen.getByTestId("protected-route")).toBeInTheDocument();
  expect(authenticatedLayoutMocks.outlet).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("status")).toBeNull();
});

test("renders a loading state while authentication redirects or resolves", async () => {
  authenticatedLayoutMocks.useAuthenticate.mockReturnValue({
    data: null,
  });

  const { default: Component } = await import("~/app/layouts/authenticated");

  render(<Component />);

  expect(screen.getByRole("status")).toBeInTheDocument();
  expect(screen.getByText("Loading OpenKitten")).toBeInTheDocument();
  expect(authenticatedLayoutMocks.outlet).not.toHaveBeenCalled();
});

test("delegates clientLoader to the authenticate helper", async () => {
  authenticatedLayoutMocks.authenticate.mockResolvedValue({
    user: { id: "user-1" },
  });

  const { clientLoader } = await import("~/app/layouts/authenticated");

  await expect(
    clientLoader({
      request: new Request("https://openkitten.dev/app?tab=home"),
    } as never),
  ).resolves.toBeNull();

  expect(authenticatedLayoutMocks.authenticate).toHaveBeenCalledWith(
    "https://openkitten.dev/app?tab=home",
  );
});

test("rethrows redirects from the authenticate helper", async () => {
  const redirectResponse = new Response(null, {
    headers: { Location: "/auth/sign-in" },
    status: 302,
  });
  authenticatedLayoutMocks.authenticate.mockRejectedValue(redirectResponse);

  const { clientLoader } = await import("~/app/layouts/authenticated");

  await expect(
    clientLoader({
      request: new Request("https://openkitten.dev/app"),
    } as never),
  ).rejects.toBe(redirectResponse);
});
