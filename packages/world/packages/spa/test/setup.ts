import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { defaultColorScheme } from "~/lib/default-color-scheme";
import { stubMatchMedia } from "~/test/stub-match-media";
import { stubObserverGlobals } from "~/test/stub-observer-globals";
import { stubStorageGlobals } from "~/test/stub-storage-globals";

stubStorageGlobals();
stubObserverGlobals();

beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  stubStorageGlobals();
  stubObserverGlobals();
  stubMatchMedia(defaultColorScheme);
  localStorage.clear();
  const { getDefaultStore } = await import("jotai");
  const store = getDefaultStore();
  const { themeAtom } = await import("~/lib/theme-atom");
  store.set(themeAtom, "system");
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.style.colorScheme = "";
});

afterEach(() => {
  cleanup();
});
