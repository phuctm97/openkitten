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
  isPersonalHouse: vi.fn(async () => false),
  syncWorkspace: vi.fn(async () => undefined),
  deleteHouse: vi.fn(async () => undefined),
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
vi.mock("~/lib/pg-database", () => {
  Object.defineProperty(authMocks.pgDatabase, "delete", {
    value: () => ({ where: authMocks.deleteHouse }),
    enumerable: false,
    configurable: true,
  });
  return { pgDatabase: authMocks.pgDatabase };
});
vi.mock("~/lib/redis", () => ({ redis: authMocks.redis }));
vi.mock("~/lib/send-react-email", () => ({
  sendReactEmail: authMocks.sendReactEmail,
}));
vi.mock("~/lib/is-personal-house", () => ({
  isPersonalHouse: authMocks.isPersonalHouse,
}));
vi.mock("~/lib/sync-workspace", () => ({
  syncWorkspace: authMocks.syncWorkspace,
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
  authMocks.isPersonalHouse.mockReset();
  authMocks.isPersonalHouse.mockResolvedValue(false);
  authMocks.syncWorkspace.mockReset();
  authMocks.syncWorkspace.mockResolvedValue(undefined);
  authMocks.deleteHouse.mockReset();
  authMocks.deleteHouse.mockResolvedValue(undefined);
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
      user: expect.anything(),
      account: expect.anything(),
      verification: expect.anything(),
      passkey: expect.anything(),
      house: expect.anything(),
      house_member: expect.anything(),
      house_invitation: expect.anything(),
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

it("registers magic-link, passkey, organization, and social-provider plugins", async () => {
  authMocks.isLive = true;
  vi.stubEnv("GOOGLE_CLIENT_ID", "google-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
  vi.stubEnv("GITHUB_CLIENT_ID", "github-id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "github-secret");

  const { auth } = await import("~/lib/auth");

  const pluginIds = (auth.options.plugins ?? []).map((plugin) => plugin.id);
  expect(pluginIds).toContain("magic-link");
  expect(pluginIds).toContain("passkey");
  expect(pluginIds).toContain("organization");
  expect(pluginIds).toContain("multi-session");
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

it("sends invitation emails through the organization plugin", async () => {
  authMocks.isLive = true;

  const { auth } = await import("~/lib/auth");

  type OrganizationPlugin = {
    id: string;
    options?: {
      sendInvitationEmail?: (data: {
        id: string;
        organization: { id: string; name: string; slug: string };
        inviter: { user: { name: string; email: string } };
        email: string;
      }) => Promise<void> | void;
    };
  };
  const orgPlugin = (auth.options.plugins ?? []).find(
    (plugin: { id: string }) => plugin.id === "organization",
  ) as OrganizationPlugin | undefined;

  await orgPlugin?.options?.sendInvitationEmail?.({
    id: "inv_1",
    organization: { id: "org_1", name: "Acme Co", slug: "acme" },
    inviter: { user: { name: "Ada", email: "ada@example.com" } },
    email: "teammate@example.com",
  });

  expect(authMocks.sendReactEmail).toHaveBeenCalledWith({
    to: "teammate@example.com",
    subject: "You've been invited to join Acme Co on OpenKitten",
    element: expect.objectContaining({
      props: expect.objectContaining({
        organizationName: "Acme Co",
        inviterName: "Ada",
        url: expect.stringContaining("invitationId=inv_1"),
      }),
    }),
  });
});

it("rethrows when invitation email delivery fails", async () => {
  authMocks.isLive = true;
  authMocks.sendReactEmail.mockRejectedValueOnce(new Error("smtp down"));
  const { auth } = await import("~/lib/auth");
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  type OrganizationPlugin = {
    id: string;
    options?: {
      sendInvitationEmail?: (data: {
        id: string;
        organization: { id: string; name: string; slug: string };
        inviter: { user: { name: string; email: string } };
        email: string;
      }) => Promise<void> | void;
    };
  };
  const orgPlugin = (auth.options.plugins ?? []).find(
    (plugin: { id: string }) => plugin.id === "organization",
  ) as OrganizationPlugin | undefined;

  await expect(
    orgPlugin?.options?.sendInvitationEmail?.({
      id: "inv_2",
      organization: { id: "org_2", name: "Acme", slug: "acme" },
      inviter: { user: { name: "Ada", email: "ada@example.com" } },
      email: "teammate@example.com",
    }),
  ).rejects.toThrow("smtp down");
  expect(errorSpy).toHaveBeenCalledWith(
    "[organization] failed to send invitation email",
    expect.objectContaining({
      invitationId: "inv_2",
      organizationId: "org_2",
      email: "teammate@example.com",
    }),
  );
  errorSpy.mockRestore();
});

it("omits social providers when env vars are not set", async () => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
  vi.stubEnv("GITHUB_CLIENT_ID", "");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "");

  const { auth } = await import("~/lib/auth");

  expect(auth.options.socialProviders).toStrictEqual({});
});

it("omits magic-link and passkey plugins when their env vars are disabled but keeps organization and multi-session", async () => {
  authMocks.isMagicLinkEnabled = false;
  authMocks.isPasskeyEnabled = false;

  const { auth } = await import("~/lib/auth");

  const pluginIds = (auth.options.plugins ?? []).map((plugin) => plugin.id);
  expect(pluginIds).not.toContain("magic-link");
  expect(pluginIds).not.toContain("passkey");
  expect(pluginIds).toStrictEqual(["multi-session", "organization"]);
});

type OrgPluginOptions = {
  organizationHooks?: {
    afterCreateOrganization?: (data: {
      organization: { id: string };
      user: { id: string };
    }) => Promise<unknown>;
    beforeUpdateOrganization?: (data: {
      member: { organizationId: string };
    }) => Promise<unknown>;
    beforeAddMember?: (data: {
      member: { organizationId: string };
    }) => Promise<unknown>;
    beforeRemoveMember?: (data: {
      member: { organizationId: string };
    }) => Promise<unknown>;
    beforeUpdateMemberRole?: (data: {
      member: { organizationId: string };
    }) => Promise<unknown>;
    beforeCreateInvitation?: (data: {
      organization: { id: string };
    }) => Promise<unknown>;
    beforeDeleteOrganization?: (data: {
      organization: { id: string };
      user: { id: string };
    }) => Promise<unknown>;
  };
};

async function getOrgHooks(): Promise<
  NonNullable<OrgPluginOptions["organizationHooks"]>
> {
  const { auth } = await import("~/lib/auth");
  const orgPlugin = (auth.options.plugins ?? []).find(
    (plugin: { id: string }) => plugin.id === "organization",
  ) as { options?: OrgPluginOptions } | undefined;
  const hooks = orgPlugin?.options?.organizationHooks;
  if (!hooks) throw new Error("organization plugin hooks not registered");
  return hooks;
}

it("provisions the workspace after a house is created", async () => {
  const hooks = await getOrgHooks();

  await hooks.afterCreateOrganization?.({
    organization: { id: "house_1" },
    user: { id: "u_1" },
  });

  expect(authMocks.syncWorkspace).toHaveBeenCalledWith({
    user: { id: "u_1" },
    activeOrganizationId: "house_1",
  });
  expect(authMocks.deleteHouse).not.toHaveBeenCalled();
});

it("rolls back the house when the workspace cannot be provisioned", async () => {
  const hooks = await getOrgHooks();
  authMocks.syncWorkspace.mockRejectedValueOnce(new Error("db down"));

  await expect(
    hooks.afterCreateOrganization?.({
      organization: { id: "house_orphan" },
      user: { id: "u_1" },
    }),
  ).rejects.toThrow();

  expect(authMocks.deleteHouse).toHaveBeenCalled();
});

it.each([
  ["beforeUpdateOrganization", "update settings"],
  ["beforeAddMember", "add members"],
  ["beforeRemoveMember", "remove members"],
  ["beforeUpdateMemberRole", "change member roles"],
] as const)("blocks %s on a personal house", async (hookName, fragment) => {
  const hooks = await getOrgHooks();
  authMocks.isPersonalHouse.mockResolvedValueOnce(true);

  const fn = hooks[hookName];
  if (!fn) throw new Error(`hook ${hookName} not registered`);

  await expect(
    fn({ member: { organizationId: "house_personal" } }),
  ).rejects.toThrow(new RegExp(fragment, "i"));
});

it.each([
  "beforeUpdateOrganization",
  "beforeAddMember",
  "beforeRemoveMember",
  "beforeUpdateMemberRole",
] as const)("allows %s on a non-personal house", async (hookName) => {
  const hooks = await getOrgHooks();
  authMocks.isPersonalHouse.mockResolvedValueOnce(false);

  const fn = hooks[hookName];
  if (!fn) throw new Error(`hook ${hookName} not registered`);

  await expect(
    fn({ member: { organizationId: "house_team" } }),
  ).resolves.toBeUndefined();
});

it("blocks beforeCreateInvitation on a personal house", async () => {
  const hooks = await getOrgHooks();
  authMocks.isPersonalHouse.mockResolvedValueOnce(true);

  await expect(
    hooks.beforeCreateInvitation?.({ organization: { id: "house_personal" } }),
  ).rejects.toThrow(/invite/i);
});

it("allows beforeCreateInvitation on a non-personal house", async () => {
  const hooks = await getOrgHooks();
  authMocks.isPersonalHouse.mockResolvedValueOnce(false);

  await expect(
    hooks.beforeCreateInvitation?.({ organization: { id: "house_team" } }),
  ).resolves.toBeUndefined();
});

it("blocks beforeDeleteOrganization on a personal house", async () => {
  const hooks = await getOrgHooks();
  authMocks.isPersonalHouse.mockResolvedValueOnce(true);

  await expect(
    hooks.beforeDeleteOrganization?.({
      organization: { id: "house_personal" },
      user: { id: "u_1" },
    }),
  ).rejects.toThrow(/personal house/i);
});

it("allows beforeDeleteOrganization on a non-personal house", async () => {
  const hooks = await getOrgHooks();
  authMocks.isPersonalHouse.mockResolvedValueOnce(false);

  await expect(
    hooks.beforeDeleteOrganization?.({
      organization: { id: "house_team" },
      user: { id: "u_1" },
    }),
  ).resolves.toBeUndefined();
});

it("calls syncWorkspace from databaseHooks.user.create.after when not live", async () => {
  authMocks.isLive = false;
  const { auth } = await import("~/lib/auth");

  await auth.options.databaseHooks?.user?.create?.after?.({
    ...authUser,
    emailVerified: false,
  });

  expect(authMocks.syncWorkspace).toHaveBeenCalledWith({
    user: expect.objectContaining({ id: authUser.id }),
  });
});

it("only calls syncWorkspace in afterEmailVerification when live", async () => {
  authMocks.isLive = true;
  const { auth } = await import("~/lib/auth");

  await auth.options.emailVerification?.afterEmailVerification?.({
    ...authUser,
    emailVerified: true,
  });

  expect(authMocks.syncWorkspace).toHaveBeenCalledWith({
    user: expect.objectContaining({ id: authUser.id }),
  });
});

it("skips afterEmailVerification syncWorkspace when not live", async () => {
  authMocks.isLive = false;
  const { auth } = await import("~/lib/auth");

  await auth.options.emailVerification?.afterEmailVerification?.({
    ...authUser,
    emailVerified: true,
  });

  expect(authMocks.syncWorkspace).not.toHaveBeenCalled();
});

it("calls syncWorkspace from databaseHooks.user.create.after when live and email is verified", async () => {
  authMocks.isLive = true;
  const { auth } = await import("~/lib/auth");

  await auth.options.databaseHooks?.user?.create?.after?.({
    ...authUser,
    emailVerified: true,
  });

  expect(authMocks.syncWorkspace).toHaveBeenCalledWith({
    user: expect.objectContaining({ id: authUser.id }),
  });
});

it("skips syncWorkspace from databaseHooks.user.create.after when live and email is not verified", async () => {
  authMocks.isLive = true;
  const { auth } = await import("~/lib/auth");

  await auth.options.databaseHooks?.user?.create?.after?.({
    ...authUser,
    emailVerified: false,
  });

  expect(authMocks.syncWorkspace).not.toHaveBeenCalled();
});

it("rethrows when syncWorkspace fails inside databaseHooks.user.create.after", async () => {
  authMocks.isLive = false;
  authMocks.syncWorkspace.mockRejectedValueOnce(new Error("db down"));
  const { auth } = await import("~/lib/auth");
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  await expect(
    auth.options.databaseHooks?.user?.create?.after?.({
      ...authUser,
      emailVerified: false,
    }),
  ).rejects.toThrow("db down");
  expect(errorSpy).toHaveBeenCalledWith(
    "[user.create.after] syncWorkspace failed",
    expect.objectContaining({ userId: authUser.id }),
  );
  errorSpy.mockRestore();
});

it("rethrows when syncWorkspace fails inside afterEmailVerification", async () => {
  authMocks.isLive = true;
  authMocks.syncWorkspace.mockRejectedValueOnce(new Error("db down"));
  const { auth } = await import("~/lib/auth");
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  await expect(
    auth.options.emailVerification?.afterEmailVerification?.({
      ...authUser,
      emailVerified: true,
    }),
  ).rejects.toThrow("db down");
  expect(errorSpy).toHaveBeenCalledWith(
    "[afterEmailVerification] syncWorkspace failed",
    expect.objectContaining({ userId: authUser.id }),
  );
  errorSpy.mockRestore();
});
