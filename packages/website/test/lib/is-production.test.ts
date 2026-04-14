import { afterEach, expect, test, vi } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  vi.resetModules();
  if (originalNodeEnv === undefined) {
    Reflect.deleteProperty(process.env, "NODE_ENV");
  } else {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  }
});

test("returns true when NODE_ENV is production", async () => {
  Object.assign(process.env, { NODE_ENV: "production" });

  const { isProduction } = await import("~/lib/is-production");

  expect(isProduction).toBe(true);
});

test("returns false when NODE_ENV is not production", async () => {
  Object.assign(process.env, { NODE_ENV: "development" });

  const { isProduction } = await import("~/lib/is-production");

  expect(isProduction).toBe(false);
});

test("returns false when NODE_ENV is unset", async () => {
  Reflect.deleteProperty(process.env, "NODE_ENV");

  const { isProduction } = await import("~/lib/is-production");

  expect(isProduction).toBe(false);
});
