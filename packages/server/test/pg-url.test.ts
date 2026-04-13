import { afterEach, describe, expect, it, vi } from "vitest";

const connectionString = "postgres://postgres:postgres@127.0.0.1:1/postgres";

describe("pgURL", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("uses PG_URL when it is set", async () => {
    vi.stubEnv("PG_URL", connectionString);

    const module = await import("../lib/pg-url");

    expect(module.pgURL).toBe(connectionString);
  });

  it("falls back to the default local postgres URL", async () => {
    vi.stubEnv("PG_URL", "");

    const module = await import("../lib/pg-url");

    expect(module.pgURL).toBe(
      "postgres://postgres:postgres@localhost:5432/postgres",
    );
  });
});
