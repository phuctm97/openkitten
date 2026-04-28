import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Route } from "~/.react-router/types/app/routes/+types/auth";

const authRouteMocks = vi.hoisted(() => ({
  authClient: {
    getSession: vi.fn(),
  },
  authRouter: vi.fn((props: { path: string }) => (
    <div data-path={props.path}>Auth Router</div>
  )),
  data: vi.fn((body: string, init: ResponseInit) => {
    return new Response(body, init);
  }),
  fetchQuery: vi.fn(),
  replace: vi.fn((to: string) => {
    return new Response(null, {
      headers: {
        Location: to,
      },
      status: 302,
    });
  }),
}));

vi.mock("~/components/auth/auth-router", () => ({
  AuthRouter: (props: { path: string }) => authRouteMocks.authRouter(props),
}));

vi.mock("react-router", () => ({
  data: authRouteMocks.data,
  replace: authRouteMocks.replace,
}));

vi.mock("~/lib/auth-client", () => ({
  authClient: authRouteMocks.authClient,
}));

vi.mock("~/lib/query-client", () => ({
  queryClient: {
    fetchQuery: authRouteMocks.fetchQuery,
  },
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("renders the auth route for the current auth path", async () => {
  const { default: Component } = await import("~/app/routes/auth");
  const authComponentProps = {
    loaderData: null,
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
        data: null,
        loaderData: null,
        handle: undefined,
      },
    ],
    params: { path: "forgot-password" },
  } satisfies Route.ComponentProps;

  render(<Component {...authComponentProps} />);

  expect(authRouteMocks.authRouter).toHaveBeenCalledWith({
    className: "relative z-10",
    path: "forgot-password",
  });
  expect(screen.getByRole("main")).toHaveClass(
    "relative",
    "grid",
    "min-h-screen",
    "overflow-hidden",
  );
  expect(
    screen.getByRole("main").querySelector("[aria-hidden='true']"),
  ).not.toBeNull();
});

test("throws 404 for an invalid auth view", async () => {
  const { clientLoader } = await import("~/app/routes/auth");

  await expect(
    clientLoader({
      params: { path: "unknown" },
      request: new Request("https://openkitten.dev/auth/unknown"),
    } as never),
  ).rejects.toMatchObject({
    status: 404,
    statusText: "Not Found",
  });

  expect(authRouteMocks.fetchQuery).not.toHaveBeenCalled();
});

test("throws 404 when the auth path is missing", async () => {
  const { clientLoader } = await import("~/app/routes/auth");

  await expect(
    clientLoader({
      params: {},
      request: new Request("https://openkitten.dev/auth"),
    } as never),
  ).rejects.toMatchObject({
    status: 404,
    statusText: "Not Found",
  });

  expect(authRouteMocks.fetchQuery).not.toHaveBeenCalled();
});

test("loads public auth views when signed out", async () => {
  authRouteMocks.fetchQuery.mockResolvedValue(null);

  const { clientLoader } = await import("~/app/routes/auth");

  await expect(
    clientLoader({
      params: { path: "sign-in" },
      request: new Request("https://openkitten.dev/auth/sign-in"),
    } as never),
  ).resolves.toBeNull();

  expect(authRouteMocks.fetchQuery).toHaveBeenCalledWith({
    queryFn: expect.any(Function),
    queryKey: ["auth", "getSession", null],
  });

  const queryOptions = authRouteMocks.fetchQuery.mock.calls[0]?.[0];

  if (!queryOptions) {
    throw new Error("Expected fetchQuery to receive session query options.");
  }

  const signal = AbortSignal.timeout(1_000);

  await queryOptions.queryFn({ signal });

  expect(authRouteMocks.authClient.getSession).toHaveBeenCalledWith({
    fetchOptions: {
      signal,
      throw: true,
    },
  });
  expect(authRouteMocks.replace).not.toHaveBeenCalled();
});

test("redirects signed-out sign-out requests back to sign-in", async () => {
  authRouteMocks.fetchQuery.mockResolvedValue(null);

  const { clientLoader } = await import("~/app/routes/auth");

  await expect(
    clientLoader({
      params: { path: "sign-out" },
      request: new Request("https://openkitten.dev/auth/sign-out"),
    } as never),
  ).rejects.toMatchObject({
    status: 302,
  });

  expect(authRouteMocks.replace).toHaveBeenCalledWith("/auth/sign-in");
});

test("lets signed-in users reach sign-out", async () => {
  authRouteMocks.fetchQuery.mockResolvedValue({
    user: {
      id: "user-1",
    },
  });

  const { clientLoader } = await import("~/app/routes/auth");

  await expect(
    clientLoader({
      params: { path: "sign-out" },
      request: new Request("https://openkitten.dev/auth/sign-out"),
    } as never),
  ).resolves.toBeNull();

  expect(authRouteMocks.replace).not.toHaveBeenCalled();
});

test("redirects signed-in auth views to the requested destination", async () => {
  authRouteMocks.fetchQuery.mockResolvedValue({
    user: {
      id: "user-1",
    },
  });

  const { clientLoader } = await import("~/app/routes/auth");

  await expect(
    clientLoader({
      params: { path: "magic-link" },
      request: new Request(
        "https://openkitten.dev/auth/magic-link?redirectTo=%2Fapp%3Ftab%3Dhome%23top",
      ),
    } as never),
  ).rejects.toMatchObject({
    status: 302,
  });

  expect(authRouteMocks.replace).toHaveBeenCalledWith("/app?tab=home#top");
});

test("redirects signed-in auth views to requested auth destinations", async () => {
  authRouteMocks.fetchQuery.mockResolvedValue({
    user: {
      id: "user-1",
    },
  });

  const { clientLoader } = await import("~/app/routes/auth");

  await expect(
    clientLoader({
      params: { path: "sign-in" },
      request: new Request(
        "https://openkitten.dev/auth/sign-in?redirectTo=%2Fauth%2Fsign-out",
      ),
    } as never),
  ).rejects.toMatchObject({
    status: 302,
  });

  expect(authRouteMocks.replace).toHaveBeenCalledWith("/auth/sign-out");
});

test("redirects signed-in auth views home when no safe destination exists", async () => {
  authRouteMocks.fetchQuery.mockResolvedValue({
    user: {
      id: "user-1",
    },
  });

  const { clientLoader } = await import("~/app/routes/auth");

  await expect(
    clientLoader({
      params: { path: "sign-in" },
      request: new Request("https://openkitten.dev/auth/sign-in"),
    } as never),
  ).rejects.toMatchObject({
    status: 302,
  });

  await expect(
    clientLoader({
      params: { path: "sign-up" },
      request: new Request(
        "https://openkitten.dev/auth/sign-up?redirectTo=https%3A%2F%2Fevil.example%2F",
      ),
    } as never),
  ).rejects.toMatchObject({
    status: 302,
  });

  expect(authRouteMocks.replace).toHaveBeenCalledWith("/");
  expect(authRouteMocks.replace).toHaveBeenCalledTimes(2);
});
