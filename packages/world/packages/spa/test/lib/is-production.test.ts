import { afterEach, expect, it, vi } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  vi.resetModules();
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

it("true when NODE_ENV is production", async () => {
  process.env.NODE_ENV = "production";

  const { isProduction } = await import("~/lib/is-production");

  expect(isProduction).toBe(true);
});

it("false when NODE_ENV is not production", async () => {
  process.env.NODE_ENV = "development";

  const { isProduction } = await import("~/lib/is-production");

  expect(isProduction).toBe(false);
});

it("false when NODE_ENV is unset", async () => {
  delete process.env.NODE_ENV;

  const { isProduction } = await import("~/lib/is-production");

  expect(isProduction).toBe(false);
});
