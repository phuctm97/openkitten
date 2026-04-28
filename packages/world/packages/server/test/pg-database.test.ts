import { afterEach, expect, it, vi } from "vitest";

const connectionString = "postgres://postgres:postgres@127.0.0.1:1/postgres";
const defaultConnectionString =
  "postgres://postgres:postgres@localhost:41240/postgres";
const originalBunArgv = [...Bun.argv];

const schemaKeys = [
  "house",
  "user",
  "session",
  "account",
  "verification",
  "passkey",
  "userRelations",
  "sessionRelations",
  "accountRelations",
  "passkeyRelations",
];

afterEach(() => {
  Bun.argv.splice(0, Bun.argv.length, ...originalBunArgv);
  vi.resetModules();
  vi.unstubAllEnvs();
});

it("creates the database from PG_URL and runs migrations", async () => {
  vi.stubEnv("PG_URL", connectionString);
  const pgDatabase = { query: { house: { findMany: vi.fn() } } };
  const drizzle = vi.fn(
    (url: string, config: { schema: Record<string, unknown> }) => {
      void url;
      void config;
      return pgDatabase;
    },
  );
  const migrate = vi.fn(
    async (
      targetDatabase: typeof pgDatabase,
      config: { migrationsFolder: string },
    ) => {
      void targetDatabase;
      void config;
    },
  );

  vi.doMock("drizzle-orm/bun-sql", () => ({ drizzle }));
  vi.doMock("drizzle-orm/bun-sql/migrator", () => ({ migrate }));

  const module = await import("~/lib/pg-database");
  const drizzleCall = drizzle.mock.calls[0];

  expect(drizzleCall).toBeDefined();
  if (!drizzleCall) {
    throw new Error("Expected drizzle to be called");
  }

  const [url, config] = drizzleCall;

  expect(module.pgDatabase).toBe(pgDatabase);
  expect(drizzle).toHaveBeenCalledTimes(1);
  expect(url).toBe(connectionString);
  expect(Object.keys(config.schema)).toStrictEqual(schemaKeys);
  expect(migrate).toHaveBeenCalledTimes(1);
  expect(migrate).toHaveBeenCalledWith(pgDatabase, {
    migrationsFolder: expect.stringContaining(
      "/packages/world/packages/server/drizzle",
    ),
  });
});

it("falls back to the default local postgres URL", async () => {
  vi.stubEnv("PG_URL", "");
  const pgDatabase = { query: { house: { findFirst: vi.fn() } } };
  const drizzle = vi.fn(
    (url: string, config: { schema: Record<string, unknown> }) => {
      void url;
      void config;
      return pgDatabase;
    },
  );
  const migrate = vi.fn(
    async (
      targetDatabase: typeof pgDatabase,
      config: { migrationsFolder: string },
    ) => {
      void targetDatabase;
      void config;
    },
  );

  vi.doMock("drizzle-orm/bun-sql", () => ({ drizzle }));
  vi.doMock("drizzle-orm/bun-sql/migrator", () => ({ migrate }));

  const module = await import("~/lib/pg-database");
  const drizzleCall = drizzle.mock.calls[0];

  expect(drizzleCall).toBeDefined();
  if (!drizzleCall) {
    throw new Error("Expected drizzle to be called");
  }

  const [url, config] = drizzleCall;

  expect(module.pgDatabase).toBe(pgDatabase);
  expect(url).toBe(defaultConnectionString);
  expect(Object.keys(config.schema)).toStrictEqual(schemaKeys);
  expect(migrate).toHaveBeenCalledWith(pgDatabase, {
    migrationsFolder: expect.stringContaining(
      "/packages/world/packages/server/drizzle",
    ),
  });
});

it("skips migrations while the better-auth CLI is running", async () => {
  Bun.argv.push("better-auth");
  const pgDatabase = { query: { user: { findFirst: vi.fn() } } };
  const drizzle = vi.fn(
    (url: string, config: { schema: Record<string, unknown> }) => {
      void url;
      void config;
      return pgDatabase;
    },
  );
  const migrate = vi.fn(async () => undefined);

  vi.doMock("drizzle-orm/bun-sql", () => ({ drizzle }));
  vi.doMock("drizzle-orm/bun-sql/migrator", () => ({ migrate }));

  const module = await import("~/lib/pg-database");

  expect(module.pgDatabase).toBe(pgDatabase);
  expect(drizzle).toHaveBeenCalledTimes(1);
  expect(migrate).not.toHaveBeenCalled();
});
