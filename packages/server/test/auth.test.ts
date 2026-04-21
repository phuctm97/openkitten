import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { serverURL } from "~/lib/server-url";
import { websiteURL } from "~/lib/website-url";
import { worldURL } from "~/lib/world-url";

const authMocks = vi.hoisted(() => ({
  betterAuth: vi.fn((options: object) => ({
    handler: vi.fn(),
    options,
  })),
  drizzleAdapter: vi.fn((database: object, config: object) => ({
    database,
    config,
  })),
  isProduction: false,
  pgDatabase: {
    query: {
      user: {
        findFirst: vi.fn(),
      },
    },
  },
  redis: {
    get: vi.fn(async (): Promise<string | null> => "cached-value"),
    set: vi.fn(async () => "OK"),
    del: vi.fn(async () => 1),
  },
  sendReactEmail: vi.fn(async () => undefined),
}));

vi.mock("better-auth", () => ({ betterAuth: authMocks.betterAuth }));
vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: authMocks.drizzleAdapter,
}));
vi.mock("~/lib/is-production", () => ({
  get isProduction() {
    return authMocks.isProduction;
  },
}));
vi.mock("~/lib/pg-database", () => ({ pgDatabase: authMocks.pgDatabase }));
vi.mock("~/lib/redis", () => ({ redis: authMocks.redis }));
vi.mock("~/lib/send-react-email", () => ({
  sendReactEmail: authMocks.sendReactEmail,
}));

const authUser = {
  id: "user-1",
  name: "Open Kitten",
  email: "user@example.com",
  emailVerified: false,
  image: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  authMocks.isProduction = false;
  authMocks.betterAuth.mockClear();
  authMocks.drizzleAdapter.mockClear();
  authMocks.pgDatabase.query.user.findFirst.mockClear();
  authMocks.redis.get.mockReset();
  authMocks.redis.get.mockResolvedValue("cached-value");
  authMocks.redis.set.mockReset();
  authMocks.redis.set.mockResolvedValue("OK");
  authMocks.redis.del.mockReset();
  authMocks.redis.del.mockResolvedValue(1);
  authMocks.sendReactEmail.mockClear();
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

it("uses the database and fallback auth URLs", {
  timeout: 10_000,
}, async () => {
  const { auth } = await import("~/lib/auth");

  expect(auth.options.appName).toBe("OpenKitten");
  expect(auth.options.baseURL).toBe(serverURL);
  expect(auth.options.basePath).toBe("/auth");
  expect(auth.options.advanced).toStrictEqual({
    cookiePrefix: "openkitten_auth",
  });
  expect(auth.options.trustedOrigins).toStrictEqual([
    serverURL,
    worldURL,
    websiteURL,
  ]);
  expect(authMocks.drizzleAdapter).toHaveBeenCalledWith(authMocks.pgDatabase, {
    provider: "pg",
    schema: expect.objectContaining({
      house: expect.anything(),
      user: expect.anything(),
      session: expect.anything(),
      account: expect.anything(),
      verification: expect.anything(),
    }),
  });
  expect(auth.options.rateLimit).toStrictEqual({
    storage: "secondary-storage",
  });
  expect(auth.options.emailVerification.sendOnSignUp).toBe(false);
  await expect(
    auth.options.databaseHooks.user.create.before?.(),
  ).resolves.toStrictEqual({
    data: { emailVerified: true },
  });

  await expect(auth.options.secondaryStorage.get("auth:key")).resolves.toBe(
    "cached-value",
  );
  await auth.options.secondaryStorage.set("auth:key", "value", undefined);
  await auth.options.secondaryStorage.set("auth:key", "value", 60);
  await auth.options.secondaryStorage.delete("auth:key");

  expect(authMocks.redis.get).toHaveBeenCalledWith("auth:key");
  expect(authMocks.redis.set).toHaveBeenNthCalledWith(1, "auth:key", "value");
  expect(authMocks.redis.set).toHaveBeenNthCalledWith(
    2,
    "auth:key",
    "value",
    "EX",
    60,
  );
  expect(authMocks.redis.del).toHaveBeenCalledWith("auth:key");
});

it("uses the runtime database and sends auth emails", async () => {
  authMocks.isProduction = true;
  authMocks.redis.get.mockResolvedValueOnce(null);

  const { auth } = await import("~/lib/auth");

  expect(auth.options.baseURL).toBe(serverURL);
  expect(auth.options.trustedOrigins).toStrictEqual([
    serverURL,
    worldURL,
    websiteURL,
  ]);
  expect(auth.options.emailVerification.sendOnSignUp).toBe(true);
  await expect(auth.options.databaseHooks.user.create.before?.()).resolves.toBe(
    undefined,
  );
  expect(authMocks.drizzleAdapter).toHaveBeenCalledWith(
    authMocks.pgDatabase,
    expect.objectContaining({ provider: "pg" }),
  );

  await auth.options.emailVerification.sendVerificationEmail?.({
    user: authUser,
    url: `${serverURL}/auth/verify`,
    token: "verify-token",
  });
  await auth.options.emailAndPassword.sendResetPassword?.({
    user: authUser,
    url: `${serverURL}/auth/reset-password`,
    token: "reset-token",
  });

  expect(authMocks.sendReactEmail).toHaveBeenNthCalledWith(1, {
    to: "user@example.com",
    subject: "Verify your email - OpenKitten",
    element: expect.objectContaining({
      props: {
        url: `${serverURL}/auth/verify`,
      },
    }),
  });
  expect(authMocks.sendReactEmail).toHaveBeenNthCalledWith(2, {
    to: "user@example.com",
    subject: "Reset your password - OpenKitten",
    element: expect.objectContaining({
      props: {
        url: `${serverURL}/auth/reset-password`,
      },
    }),
  });
});
