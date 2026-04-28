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

test("stores the normalized callback in both session and local storage", async () => {
  const { produceCallback } = await import("~/lib/produce-callback");

  produceCallback("https://world.openkitten.dev/app?tab=home#anchor");

  expect(sessionStorage.getItem(callbackStorageKey)).toBe(
    "/app?tab=home#anchor",
  );
  expect(localStorage.getItem(callbackStorageKey)).toBe("/app?tab=home#anchor");
});

test("clears storage when neither the stored callback nor the new URL has a target", async () => {
  sessionStorage.setItem(callbackStorageKey, "/");
  localStorage.setItem(callbackStorageKey, "/");

  const { produceCallback } = await import("~/lib/produce-callback");

  produceCallback("https://world.openkitten.dev/");

  expect(sessionStorage.getItem(callbackStorageKey)).toBeNull();
  expect(localStorage.getItem(callbackStorageKey)).toBeNull();
});

test("preserves the existing stored callback when a new visit lands on the root", async () => {
  sessionStorage.setItem(callbackStorageKey, "/keep-me");
  localStorage.setItem(callbackStorageKey, "/keep-me");

  const { produceCallback } = await import("~/lib/produce-callback");

  produceCallback("https://world.openkitten.dev/");

  expect(sessionStorage.getItem(callbackStorageKey)).toBe("/keep-me");
  expect(localStorage.getItem(callbackStorageKey)).toBe("/keep-me");
});

test("swallows storage errors during writes", async () => {
  const throwOnWrite = () => {
    throw new Error("quota exceeded");
  };
  vi.spyOn(sessionStorage, "setItem").mockImplementation(throwOnWrite);
  vi.spyOn(localStorage, "setItem").mockImplementation(throwOnWrite);

  const { produceCallback } = await import("~/lib/produce-callback");

  expect(() => {
    produceCallback("https://world.openkitten.dev/app");
  }).not.toThrow();
});

test("swallows storage errors during clears", async () => {
  const throwOnRemove = () => {
    throw new Error("storage disabled");
  };
  vi.spyOn(sessionStorage, "removeItem").mockImplementation(throwOnRemove);
  vi.spyOn(localStorage, "removeItem").mockImplementation(throwOnRemove);

  const { produceCallback } = await import("~/lib/produce-callback");

  expect(() => {
    produceCallback("https://world.openkitten.dev/");
  }).not.toThrow();
});
