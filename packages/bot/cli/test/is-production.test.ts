import { afterEach, beforeEach, expect, test, vi } from "vitest";

const originalNodeEnv = Bun.env.NODE_ENV;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete Bun.env.NODE_ENV;
  } else {
    Bun.env.NODE_ENV = originalNodeEnv;
  }
});

test("true when NODE_ENV is production", async () => {
  Bun.env.NODE_ENV = "production";
  const { isProduction } = await import("~/lib/is-production");
  expect(isProduction).toBe(true);
});

test("false when NODE_ENV is not production", async () => {
  Bun.env.NODE_ENV = "development";
  const { isProduction } = await import("~/lib/is-production");
  expect(isProduction).toBe(false);
});

test("false when NODE_ENV is unset", async () => {
  delete Bun.env.NODE_ENV;
  const { isProduction } = await import("~/lib/is-production");
  expect(isProduction).toBe(false);
});
