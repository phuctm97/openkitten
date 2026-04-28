import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

it("creates a Bun redis client from the configured URL", async () => {
  vi.stubEnv("REDIS_URL", "redis://127.0.0.1:1");

  const module = await import("~/lib/redis");

  expect(module.redis.constructor.name).toBe("RedisClient");
  module.redis.close();
});
