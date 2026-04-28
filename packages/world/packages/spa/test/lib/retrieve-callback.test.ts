import { afterEach, expect, test, vi } from "vitest";

import { callbackStorageKey } from "~/lib/callback-storage-key";
import { retrieveCallback } from "~/lib/retrieve-callback";

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});

test("returns the empty string when no callback is stored", () => {
  expect(retrieveCallback()).toBe("");
});

test("ignores root-only callbacks", () => {
  sessionStorage.setItem(callbackStorageKey, "/");
  localStorage.setItem(callbackStorageKey, "/");

  expect(retrieveCallback()).toBe("");
});

test("prefers session storage over local storage", () => {
  sessionStorage.setItem(callbackStorageKey, "/session-target");
  localStorage.setItem(callbackStorageKey, "/local-target");

  expect(retrieveCallback()).toBe("/session-target");
});

test("falls back to local storage when session storage is empty", () => {
  localStorage.setItem(callbackStorageKey, "/local-target");

  expect(retrieveCallback()).toBe("/local-target");
});

test("returns the empty string when storage access throws", () => {
  const throwOnRead = () => {
    throw new Error("storage disabled");
  };
  vi.spyOn(sessionStorage, "getItem").mockImplementation(throwOnRead);
  vi.spyOn(localStorage, "getItem").mockImplementation(throwOnRead);

  expect(retrieveCallback()).toBe("");
});
