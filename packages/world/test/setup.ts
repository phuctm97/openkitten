import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { getDefaultStore } from "jotai";
import { afterEach, beforeEach, vi } from "vitest";

import { defaultColorScheme } from "~/lib/default-color-scheme";
import { themeAtom } from "~/lib/theme-atom";
import { stubMatchMedia } from "~/test/stub-match-media";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  stubMatchMedia(defaultColorScheme);
  localStorage.clear();
  const store = getDefaultStore();
  store.set(themeAtom, "auto");
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.style.colorScheme = "";
});

afterEach(() => {
  cleanup();
});
