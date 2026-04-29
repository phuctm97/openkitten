import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { expect, test, vi } from "vitest";

const betterAuthMocks = vi.hoisted(() => ({
  authProvider: vi.fn(),
}));

const navigateMock = vi.hoisted(() => vi.fn());

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

vi.mock("jotai", async () => {
  const actual = await vi.importActual<typeof import("jotai")>("jotai");
  return {
    ...actual,
    useSetAtom: () => navigateMock,
  };
});

vi.mock("@better-auth-ui/react", async () => {
  const react = await vi.importActual<typeof import("react")>("react");

  return {
    AuthProvider: (props: { children: ReactNode }) => {
      betterAuthMocks.authProvider(props);

      return react.createElement(
        "div",
        { "data-testid": "better-auth-provider" },
        props.children,
      );
    },
  };
});

test("connects Better Auth UI to world auth, routing, links, and query client", async () => {
  const { AuthProvider } = await import("~/components/auth/auth-provider");
  const { AuthLink } = await import("~/components/auth/auth-link");
  const { authClient } = await import("~/lib/auth-client");
  const { queryClient } = await import("~/lib/query-client");
  const { isMagicLinkEnabled, isPasskeyEnabled, worldURL } = await import(
    "@openkitten/world-util"
  );

  render(
    <AuthProvider>
      <span>Auth children</span>
    </AuthProvider>,
  );

  expect(screen.getByText("Auth children")).toBeInTheDocument();
  const providerProps = betterAuthMocks.authProvider.mock.calls[0]?.[0] as {
    authClient: unknown;
    baseURL: string;
    Link: unknown;
    navigate: (options: { to: string; replace?: boolean }) => void;
    queryClient: unknown;
    magicLink: boolean;
    passkey: boolean;
    redirectTo: string;
    socialProviders: string[];
  };

  expect(providerProps.authClient).toBe(authClient);
  expect(providerProps.baseURL).toBe(worldURL);
  expect(providerProps.Link).toBe(AuthLink);
  expect(providerProps.queryClient).toBe(queryClient);
  expect(providerProps.redirectTo).toBe("/auth-callback");
  expect(providerProps.magicLink).toBe(isMagicLinkEnabled);
  expect(providerProps.passkey).toBe(isPasskeyEnabled);
  expect(providerProps.socialProviders).toStrictEqual(["google", "github"]);

  providerProps.navigate({ to: "/auth/sign-in", replace: true });

  expect(navigateMock).toHaveBeenCalledWith("/auth/sign-in", {
    replace: true,
  });
});
