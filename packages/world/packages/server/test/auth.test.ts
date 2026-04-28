import { serverURL, websiteURL, worldURL } from "@openkitten/world-util";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  betterAuth: vi.fn((options: object) => ({
    handler: vi.fn(),
    options,
  })),
  drizzleAdapter: vi.fn((database: object, config: object) => ({
    database,
    config,
  })),
  isLive: false,
  isMagicLinkEnabled: true,
  isPasskeyEnabled: true,
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
vi.mock("@openkitten/world-util", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@openkitten/world-util")>();
  return {
    ...actual,
    get isLive() {
      return authMocks.isLive;
    },
    get isMagicLinkEnabled() {
      return authMocks.isMagicLinkEnabled;
    },
    get isPasskeyEnabled() {
      return authMocks.isPasskeyEnabled;
    },
  };
});
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
  authMocks.isLive = false;
  authMocks.isMagicLinkEnabled = true;
  authMocks.isPasskeyEnabled = true;
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
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: false,
    },
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
  authMocks.isLive = true;
  authMocks.redis.get.mockResolvedValueOnce(null);

  const { auth } = await import("~/lib/auth");

  expect(auth.options.baseURL).toBe(serverURL);
  expect(auth.options.trustedOrigins).toStrictEqual([
    serverURL,
    worldURL,
    websiteURL,
  ]);
  expect(auth.options.advanced).toStrictEqual({
    cookiePrefix: "openkitten_auth",
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: true,
    },
  });
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
    url: `${serverURL}/auth/verify?token=abc`,
    token: "verify-token",
  });
  await auth.options.emailVerification.sendVerificationEmail?.({
    user: authUser,
    url: `${serverURL}/auth/verify?token=abc&callbackURL=${encodeURIComponent(`${worldURL}/profile`)}`,
    token: "verify-token",
  });
  await auth.options.emailVerification.sendVerificationEmail?.({
    user: authUser,
    url: `${serverURL}/auth/verify?token=abc&callbackURL=${encodeURIComponent("https://evil.example/steal")}`,
    token: "verify-token",
  });
  await auth.options.emailVerification.sendVerificationEmail?.({
    user: authUser,
    url: `${serverURL}/auth/verify?token=abc&callbackURL=not-a-url`,
    token: "verify-token",
  });
  await auth.options.emailAndPassword.sendResetPassword?.({
    user: authUser,
    url: `${serverURL}/auth/reset-password`,
    token: "reset-token",
  });
  type MagicLinkPlugin = {
    id: string;
    options?: {
      sendMagicLink?: (data: {
        email: string;
        url: string;
        token: string;
      }) => Promise<void> | void;
    };
  };
  const magicLinkPlugin = (auth.options.plugins ?? []).find(
    (plugin: { id: string }) => plugin.id === "magic-link",
  ) as MagicLinkPlugin | undefined;
  await magicLinkPlugin?.options?.sendMagicLink?.({
    email: "user@example.com",
    url: `${serverURL}/auth/magic-link?token=abc`,
    token: "magic-token",
  });

  expect(authMocks.sendReactEmail).toHaveBeenNthCalledWith(1, {
    to: "user@example.com",
    subject: "Verify your email - OpenKitten",
    element: expect.objectContaining({
      props: {
        url: `${serverURL}/auth/verify?token=abc&callbackURL=${encodeURIComponent(
          `${worldURL}/auth-callback`,
        )}`,
      },
    }),
  });
  expect(authMocks.sendReactEmail).toHaveBeenNthCalledWith(2, {
    to: "user@example.com",
    subject: "Verify your email - OpenKitten",
    element: expect.objectContaining({
      props: {
        url: `${serverURL}/auth/verify?token=abc&callbackURL=${encodeURIComponent(
          `${worldURL}/profile`,
        )}`,
      },
    }),
  });
  expect(authMocks.sendReactEmail).toHaveBeenNthCalledWith(3, {
    to: "user@example.com",
    subject: "Verify your email - OpenKitten",
    element: expect.objectContaining({
      props: {
        url: `${serverURL}/auth/verify?token=abc&callbackURL=${encodeURIComponent(
          `${worldURL}/auth-callback`,
        )}`,
      },
    }),
  });
  expect(authMocks.sendReactEmail).toHaveBeenNthCalledWith(4, {
    to: "user@example.com",
    subject: "Verify your email - OpenKitten",
    element: expect.objectContaining({
      props: {
        url: `${serverURL}/auth/verify?token=abc&callbackURL=${encodeURIComponent(
          `${worldURL}/auth-callback`,
        )}`,
      },
    }),
  });
  expect(authMocks.sendReactEmail).toHaveBeenNthCalledWith(5, {
    to: "user@example.com",
    subject: "Reset your password - OpenKitten",
    element: expect.objectContaining({
      props: {
        url: `${serverURL}/auth/reset-password`,
      },
    }),
  });
  expect(authMocks.sendReactEmail).toHaveBeenNthCalledWith(6, {
    to: "user@example.com",
    subject: "Sign in to OpenKitten",
    element: expect.objectContaining({
      props: {
        url: `${serverURL}/auth/magic-link?token=abc&callbackURL=${encodeURIComponent(
          `${worldURL}/auth-callback`,
        )}`,
      },
    }),
  });
});

it("registers magic-link, passkey, and social-provider plugins", async () => {
  authMocks.isLive = true;
  vi.stubEnv("GOOGLE_CLIENT_ID", "google-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
  vi.stubEnv("GITHUB_CLIENT_ID", "github-id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "github-secret");

  const { auth } = await import("~/lib/auth");

  const pluginIds = (auth.options.plugins ?? []).map((plugin) => plugin.id);
  expect(pluginIds).toContain("magic-link");
  expect(pluginIds).toContain("passkey");
  expect(auth.options.socialProviders).toStrictEqual({
    google: {
      clientId: "google-id",
      clientSecret: "google-secret",
    },
    github: {
      clientId: "github-id",
      clientSecret: "github-secret",
    },
  });
});

it("omits social providers when env vars are not set", async () => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
  vi.stubEnv("GITHUB_CLIENT_ID", "");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "");

  const { auth } = await import("~/lib/auth");

  expect(auth.options.socialProviders).toStrictEqual({});
});

it("omits magic-link and passkey plugins when their env vars are disabled", async () => {
  authMocks.isMagicLinkEnabled = false;
  authMocks.isPasskeyEnabled = false;

  const { auth } = await import("~/lib/auth");

  const pluginIds = (auth.options.plugins ?? []).map((plugin) => plugin.id);
  expect(pluginIds).not.toContain("magic-link");
  expect(pluginIds).not.toContain("passkey");
  expect(auth.options.plugins).toStrictEqual([]);
});
