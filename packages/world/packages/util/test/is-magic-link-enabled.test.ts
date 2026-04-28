import { afterEach, beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("defaults to disabled when env var is unset", async () => {
  vi.stubEnv("OPENKITTEN_MAGIC_LINK_ENABLED", "");

  const { isMagicLinkEnabled } = await import("~/lib/is-magic-link-enabled");

  expect(isMagicLinkEnabled).toBe(false);
});

test("treats '1' as enabled", async () => {
  vi.stubEnv("OPENKITTEN_MAGIC_LINK_ENABLED", "1");

  const { isMagicLinkEnabled } = await import("~/lib/is-magic-link-enabled");

  expect(isMagicLinkEnabled).toBe(true);
});

test("treats 'true' as enabled", async () => {
  vi.stubEnv("OPENKITTEN_MAGIC_LINK_ENABLED", "true");

  const { isMagicLinkEnabled } = await import("~/lib/is-magic-link-enabled");

  expect(isMagicLinkEnabled).toBe(true);
});

test("treats other strings as disabled", async () => {
  vi.stubEnv("OPENKITTEN_MAGIC_LINK_ENABLED", "yes");

  const { isMagicLinkEnabled } = await import("~/lib/is-magic-link-enabled");

  expect(isMagicLinkEnabled).toBe(false);
});
