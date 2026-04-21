import { afterEach, expect, it, vi } from "vitest";

const connectionString = "redis://127.0.0.1:1";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

it("uses REDIS_URL when it is set", async () => {
  vi.stubEnv("REDIS_URL", connectionString);

  const module = await import("~/lib/redis-url");

  expect(module.redisURL).toBe(connectionString);
});

it("falls back to the default local redis URL", async () => {
  vi.stubEnv("REDIS_URL", "");

  const module = await import("~/lib/redis-url");

  expect(module.redisURL).toBe("redis://localhost:41241");
});
