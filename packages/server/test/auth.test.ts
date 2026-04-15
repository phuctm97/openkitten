import { afterEach, expect, it, vi } from "vitest";
import { serverURL } from "~/lib/server-url";
import { websiteURL } from "~/lib/website-url";
import { worldURL } from "~/lib/world-url";

const authUser = {
  id: "user-1",
  name: "Open Kitten",
  email: "user@example.com",
  emailVerified: false,
  image: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

it("uses the database and fallback auth URLs", async () => {
  const betterAuth = vi.fn((options: object) => ({
    handler: vi.fn(),
    options,
  }));
  const drizzleAdapter = vi.fn((database: object, config: object) => ({
    database,
    config,
  }));
  const pgDatabase = { query: { user: { findFirst: vi.fn() } } };
  const redis = {
    get: vi.fn(async () => "cached-value"),
    set: vi.fn(async () => "OK"),
    del: vi.fn(async () => 1),
  };

  vi.doMock("better-auth", () => ({ betterAuth }));
  vi.doMock("better-auth/adapters/drizzle", () => ({ drizzleAdapter }));
  vi.doMock("bun", () => ({ redis }));
  vi.doMock("~/lib/is-production", () => ({ isProduction: false }));
  vi.doMock("~/lib/pg-database", () => ({ pgDatabase }));

  const { auth } = await import("~/lib/auth");

  expect(auth.options.appName).toBe("OpenKitten");
  expect(auth.options.baseURL).toBe(serverURL);
  expect(auth.options.basePath).toBe("/v1/auth");
  expect(auth.options.trustedOrigins).toStrictEqual([
    serverURL,
    worldURL,
    websiteURL,
  ]);
  expect(drizzleAdapter).toHaveBeenCalledWith(pgDatabase, {
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

  expect(redis.get).toHaveBeenCalledWith("auth:key");
  expect(redis.set).toHaveBeenNthCalledWith(1, "auth:key", "value");
  expect(redis.set).toHaveBeenNthCalledWith(2, "auth:key", "value", "EX", 60);
  expect(redis.del).toHaveBeenCalledWith("auth:key");
});

it("uses the runtime database and sends auth emails", async () => {
  const betterAuth = vi.fn((options: object) => ({
    handler: vi.fn(),
    options,
  }));
  const drizzleAdapter = vi.fn((database: object, config: object) => ({
    database,
    config,
  }));
  const pgDatabase = { query: { user: { findFirst: vi.fn() } } };
  const sendReactEmail = vi.fn(async () => undefined);
  const redis = {
    get: vi.fn(async () => null),
    set: vi.fn(async () => "OK"),
    del: vi.fn(async () => 1),
  };

  vi.doMock("better-auth", () => ({ betterAuth }));
  vi.doMock("better-auth/adapters/drizzle", () => ({ drizzleAdapter }));
  vi.doMock("bun", () => ({ redis }));
  vi.doMock("~/lib/is-production", () => ({ isProduction: true }));
  vi.doMock("~/lib/pg-database", () => ({ pgDatabase }));
  vi.doMock("~/lib/send-react-email", () => ({ sendReactEmail }));

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
  expect(drizzleAdapter).toHaveBeenCalledWith(
    pgDatabase,
    expect.objectContaining({ provider: "pg" }),
  );

  await auth.options.emailVerification.sendVerificationEmail?.({
    user: authUser,
    url: `${serverURL}/v1/auth/verify`,
    token: "verify-token",
  });
  await auth.options.emailAndPassword.sendResetPassword?.({
    user: authUser,
    url: `${serverURL}/v1/auth/reset-password`,
    token: "reset-token",
  });

  expect(sendReactEmail).toHaveBeenNthCalledWith(1, {
    to: "user@example.com",
    subject: "Verify your email - OpenKitten",
    element: expect.objectContaining({
      props: {
        url: `${serverURL}/v1/auth/verify`,
      },
    }),
  });
  expect(sendReactEmail).toHaveBeenNthCalledWith(2, {
    to: "user@example.com",
    subject: "Reset your password - OpenKitten",
    element: expect.objectContaining({
      props: {
        url: `${serverURL}/v1/auth/reset-password`,
      },
    }),
  });
});
