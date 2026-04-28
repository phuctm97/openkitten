import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { callbackStorageKey } from "~/lib/callback-storage-key";

beforeEach(() => {
  vi.stubGlobal("location", { origin: "https://world.openkitten.dev" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

test("returns the stored callback and clears both storages", async () => {
  sessionStorage.setItem(callbackStorageKey, "/app?tab=home");
  localStorage.setItem(callbackStorageKey, "/app?tab=home");

  const { consumeCallback } = await import("~/lib/consume-callback");

  expect(consumeCallback()).toBe("/app?tab=home");
  expect(sessionStorage.getItem(callbackStorageKey)).toBeNull();
  expect(localStorage.getItem(callbackStorageKey)).toBeNull();
});

test("returns root when no callback is stored", async () => {
  const { consumeCallback } = await import("~/lib/consume-callback");

  expect(consumeCallback()).toBe("/");
});

test("swallows storage errors when clearing", async () => {
  sessionStorage.setItem(callbackStorageKey, "/keep-me");
  localStorage.setItem(callbackStorageKey, "/keep-me");
  const throwOnRemove = () => {
    throw new Error("storage disabled");
  };
  vi.spyOn(sessionStorage, "removeItem").mockImplementation(throwOnRemove);
  vi.spyOn(localStorage, "removeItem").mockImplementation(throwOnRemove);

  const { consumeCallback } = await import("~/lib/consume-callback");

  expect(() => consumeCallback()).not.toThrow();
});
