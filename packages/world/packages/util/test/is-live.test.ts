import { afterEach, beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("defaults to true when not local", async () => {
  vi.stubEnv("OPENKITTEN_LOCAL", "");

  const { isLive } = await import("~/lib/is-live");

  expect(isLive).toBe(true);
});

test("flips to false in local mode", async () => {
  vi.stubEnv("OPENKITTEN_LOCAL", "1");

  const { isLive } = await import("~/lib/is-live");

  expect(isLive).toBe(false);
});
