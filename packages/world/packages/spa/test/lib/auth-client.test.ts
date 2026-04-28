import { beforeEach, expect, it, vi } from "vitest";

const authClientMocks = vi.hoisted(() => {
  const authClient = { useSession: vi.fn() };
  const magicLinkPlugin = { id: "magic-link" };
  const passkeyPlugin = { id: "passkey" };

  return {
    authClient,
    createAuthClient: vi.fn(() => authClient),
    magicLinkClient: vi.fn(() => magicLinkPlugin),
    magicLinkPlugin,
    passkeyClient: vi.fn(() => passkeyPlugin),
    passkeyPlugin,
  };
});

vi.mock("better-auth/react", () => ({
  createAuthClient: authClientMocks.createAuthClient,
}));

vi.mock("better-auth/client/plugins", () => ({
  magicLinkClient: authClientMocks.magicLinkClient,
}));

vi.mock("@better-auth/passkey/client", () => ({
  passkeyClient: authClientMocks.passkeyClient,
}));

beforeEach(() => {
  authClientMocks.createAuthClient.mockClear();
  authClientMocks.magicLinkClient.mockClear();
  authClientMocks.passkeyClient.mockClear();
  vi.resetModules();
});

it("creates a Better Auth React client for the local auth endpoint", async () => {
  const { authClient } = await import("~/lib/auth-client");

  expect(authClient).toBe(authClientMocks.authClient);
  expect(authClientMocks.createAuthClient).toHaveBeenCalledTimes(1);

  expect(authClientMocks.createAuthClient).toHaveBeenCalledWith({
    baseURL: "http://localhost:41237",
    basePath: "/auth",
    plugins: [authClientMocks.magicLinkPlugin, authClientMocks.passkeyPlugin],
  });
  expect(authClientMocks.magicLinkClient).toHaveBeenCalledTimes(1);
  expect(authClientMocks.passkeyClient).toHaveBeenCalledTimes(1);
});
