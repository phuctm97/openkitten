import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const authenticatedLayoutMocks = vi.hoisted(() => ({
  authClient: {
    getSession: vi.fn(),
  },
  fetchQuery: vi.fn(),
  outlet: vi.fn(() => <div data-testid="protected-route" />),
  replace: vi.fn((to: string) => {
    return new Response(null, {
      headers: {
        Location: to,
      },
      status: 302,
    });
  }),
  useAuthenticate: vi.fn(),
}));

vi.mock("@better-auth-ui/react", () => ({
  useAuthenticate: authenticatedLayoutMocks.useAuthenticate,
}));

vi.mock("react-router", () => ({
  Outlet: () => authenticatedLayoutMocks.outlet(),
  replace: authenticatedLayoutMocks.replace,
}));

vi.mock("~/lib/auth-client", () => ({
  authClient: authenticatedLayoutMocks.authClient,
}));

vi.mock("~/lib/query-client", () => ({
  queryClient: {
    fetchQuery: authenticatedLayoutMocks.fetchQuery,
  },
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

test("allows protected routes to load when a session exists", async () => {
  const session = {
    user: {
      id: "user-1",
    },
  };

  authenticatedLayoutMocks.fetchQuery.mockResolvedValue(session);

  const { clientLoader } = await import("~/app/layouts/authenticated");

  await expect(
    clientLoader({
      request: new Request("https://openkitten.dev/app"),
    } as never),
  ).resolves.toBeNull();

  expect(authenticatedLayoutMocks.fetchQuery).toHaveBeenCalledWith({
    queryFn: expect.any(Function),
    queryKey: ["auth", "getSession", null],
  });

  const queryOptions = authenticatedLayoutMocks.fetchQuery.mock.calls[0]?.[0];

  if (!queryOptions) {
    throw new Error("Expected fetchQuery to receive session query options.");
  }

  const signal = AbortSignal.timeout(1_000);

  await queryOptions.queryFn({ signal });

  expect(authenticatedLayoutMocks.authClient.getSession).toHaveBeenCalledWith({
    query: undefined,
    fetchOptions: {
      signal,
      throw: true,
    },
  });
  expect(authenticatedLayoutMocks.replace).not.toHaveBeenCalled();
});

test("redirects protected routes to sign-in when no session exists", async () => {
  authenticatedLayoutMocks.fetchQuery.mockResolvedValue(null);

  const { clientLoader } = await import("~/app/layouts/authenticated");

  await expect(
    clientLoader({
      request: new Request("https://openkitten.dev/app?tab=home"),
    } as never),
  ).rejects.toMatchObject({
    status: 302,
  });

  expect(authenticatedLayoutMocks.replace).toHaveBeenCalledWith(
    "/auth/sign-in?redirectTo=%2Fapp%3Ftab%3Dhome",
  );
});
