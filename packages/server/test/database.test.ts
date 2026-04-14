import { afterEach, expect, it, vi } from "vitest";

const connectionString = "postgres://postgres:postgres@127.0.0.1:1/postgres";
const defaultConnectionString =
  "postgres://postgres:postgres@localhost:5432/postgres";

afterEach(() => {
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

  const module = await import("../lib/pg-database");
  const drizzleCall = drizzle.mock.calls[0];

  expect(drizzleCall).toBeDefined();
  if (!drizzleCall) {
    throw new Error("Expected drizzle to be called");
  }

  const [url, config] = drizzleCall;

  expect(module.pgDatabase).toBe(pgDatabase);
  expect(drizzle).toHaveBeenCalledTimes(1);
  expect(url).toBe(connectionString);
  expect(Object.keys(config.schema)).toStrictEqual(["house"]);
  expect(migrate).toHaveBeenCalledTimes(1);
  expect(migrate).toHaveBeenCalledWith(pgDatabase, {
    migrationsFolder: expect.stringContaining("/packages/server/drizzle"),
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

  const module = await import("../lib/pg-database");
  const drizzleCall = drizzle.mock.calls[0];

  expect(drizzleCall).toBeDefined();
  if (!drizzleCall) {
    throw new Error("Expected drizzle to be called");
  }

  const [url, config] = drizzleCall;

  expect(module.pgDatabase).toBe(pgDatabase);
  expect(url).toBe(defaultConnectionString);
  expect(Object.keys(config.schema)).toStrictEqual(["house"]);
  expect(migrate).toHaveBeenCalledWith(pgDatabase, {
    migrationsFolder: expect.stringContaining("/packages/server/drizzle"),
  });
});
