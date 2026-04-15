import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { getDefaultStore } from "jotai";
import { afterEach, beforeEach, vi } from "vitest";

import { defaultColorScheme } from "~/lib/default-color-scheme";
import { stubMatchMedia } from "~/test/stub-match-media";

function createStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function stubStorageGlobals() {
  vi.stubGlobal("localStorage", createStorage());
  vi.stubGlobal("sessionStorage", createStorage());
}

stubStorageGlobals();

beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  stubStorageGlobals();
  stubMatchMedia(defaultColorScheme);
  localStorage.clear();
  const { themeAtom } = await import("~/lib/theme-atom");
  const store = getDefaultStore();
  store.set(themeAtom, "system");
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.style.colorScheme = "";
});

afterEach(() => {
  cleanup();
});
