import { afterEach, beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("defaults to disabled when env var is unset", async () => {
  vi.stubEnv("OPENKITTEN_PASSKEY_ENABLED", "");

  const { isPasskeyEnabled } = await import("~/lib/is-passkey-enabled");

  expect(isPasskeyEnabled).toBe(false);
});

test("treats '1' as enabled", async () => {
  vi.stubEnv("OPENKITTEN_PASSKEY_ENABLED", "1");

  const { isPasskeyEnabled } = await import("~/lib/is-passkey-enabled");

  expect(isPasskeyEnabled).toBe(true);
});

test("treats 'true' as enabled", async () => {
  vi.stubEnv("OPENKITTEN_PASSKEY_ENABLED", "true");

  const { isPasskeyEnabled } = await import("~/lib/is-passkey-enabled");

  expect(isPasskeyEnabled).toBe(true);
});

test("treats other strings as disabled", async () => {
  vi.stubEnv("OPENKITTEN_PASSKEY_ENABLED", "off");

  const { isPasskeyEnabled } = await import("~/lib/is-passkey-enabled");

  expect(isPasskeyEnabled).toBe(false);
});
