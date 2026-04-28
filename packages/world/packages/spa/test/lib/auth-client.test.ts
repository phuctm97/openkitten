import { beforeEach, expect, it, vi } from "vitest";

const authClientMocks = vi.hoisted(() => {
  const authClient = { useSession: vi.fn() };

  return {
    authClient,
    createAuthClient: vi.fn(() => authClient),
  };
});

vi.mock("better-auth/react", () => ({
  createAuthClient: authClientMocks.createAuthClient,
}));

beforeEach(() => {
  authClientMocks.createAuthClient.mockClear();
  vi.resetModules();
});

it("creates a Better Auth React client for the local auth endpoint", async () => {
  const { authClient } = await import("~/lib/auth-client");

  expect(authClient).toBe(authClientMocks.authClient);
  expect(authClientMocks.createAuthClient).toHaveBeenCalledTimes(1);
  expect(authClientMocks.createAuthClient).toHaveBeenCalledWith({
    baseURL: "http://localhost:41237",
    basePath: "/auth",
  });
});
