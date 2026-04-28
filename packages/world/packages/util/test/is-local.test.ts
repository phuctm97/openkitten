import { afterEach, beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("defaults to false when OPENKITTEN_LOCAL is unset", async () => {
  vi.stubEnv("OPENKITTEN_LOCAL", "");

  const { isLocal } = await import("~/lib/is-local");

  expect(isLocal).toBe(false);
});

test("treats '1' as local", async () => {
  vi.stubEnv("OPENKITTEN_LOCAL", "1");

  const { isLocal } = await import("~/lib/is-local");

  expect(isLocal).toBe(true);
});

test("treats 'true' as local", async () => {
  vi.stubEnv("OPENKITTEN_LOCAL", "true");

  const { isLocal } = await import("~/lib/is-local");

  expect(isLocal).toBe(true);
});

test("treats other strings as not local", async () => {
  vi.stubEnv("OPENKITTEN_LOCAL", "yes");

  const { isLocal } = await import("~/lib/is-local");

  expect(isLocal).toBe(false);
});
