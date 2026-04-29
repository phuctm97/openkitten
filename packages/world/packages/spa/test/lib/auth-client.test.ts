import { beforeEach, expect, it, vi } from "vitest";

const authClientMocks = vi.hoisted(() => {
  const authClient = { useSession: vi.fn() };
  const magicLinkPlugin = { id: "magic-link" };
  const passkeyPlugin = { id: "passkey" };
  const organizationPlugin = { id: "organization" };
  const multiSessionPlugin = { id: "multi-session" };

  return {
    authClient,
    createAuthClient: vi.fn(() => authClient),
    magicLinkClient: vi.fn(() => magicLinkPlugin),
    magicLinkPlugin,
    passkeyClient: vi.fn(() => passkeyPlugin),
    passkeyPlugin,
    organizationClient: vi.fn(() => organizationPlugin),
    organizationPlugin,
    multiSessionClient: vi.fn(() => multiSessionPlugin),
    multiSessionPlugin,
  };
});

vi.mock("better-auth/react", () => ({
  createAuthClient: authClientMocks.createAuthClient,
}));

vi.mock("better-auth/client/plugins", () => ({
  magicLinkClient: authClientMocks.magicLinkClient,
  organizationClient: authClientMocks.organizationClient,
  multiSessionClient: authClientMocks.multiSessionClient,
}));

vi.mock("@better-auth/passkey/client", () => ({
  passkeyClient: authClientMocks.passkeyClient,
}));

beforeEach(() => {
  authClientMocks.createAuthClient.mockClear();
  authClientMocks.magicLinkClient.mockClear();
  authClientMocks.passkeyClient.mockClear();
  authClientMocks.organizationClient.mockClear();
  authClientMocks.multiSessionClient.mockClear();
  vi.resetModules();
});

it("creates a Better Auth React client with all required plugins", async () => {
  const { authClient } = await import("~/lib/auth-client");

  expect(authClient).toBe(authClientMocks.authClient);
  expect(authClientMocks.createAuthClient).toHaveBeenCalledTimes(1);

  expect(authClientMocks.createAuthClient).toHaveBeenCalledWith({
    baseURL: "http://localhost:41237",
    basePath: "/auth",
    plugins: [
      authClientMocks.magicLinkPlugin,
      authClientMocks.passkeyPlugin,
      authClientMocks.organizationPlugin,
      authClientMocks.multiSessionPlugin,
    ],
  });
  expect(authClientMocks.magicLinkClient).toHaveBeenCalledTimes(1);
  expect(authClientMocks.passkeyClient).toHaveBeenCalledTimes(1);
  expect(authClientMocks.organizationClient).toHaveBeenCalledTimes(1);
  expect(authClientMocks.multiSessionClient).toHaveBeenCalledTimes(1);
});
