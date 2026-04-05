import { atomWithStorage } from "jotai/utils";

import { isTheme } from "~/lib/is-theme";
import type { Theme } from "~/lib/theme";

export const themeAtom = atomWithStorage<Theme>(
  "openkitten-world-theme",
  "auto",
  {
    getItem: (key, initialValue) => {
      if (import.meta.env.SSR) return initialValue;
      const value = localStorage.getItem(key);
      return isTheme(value) ? value : initialValue;
    },
    setItem: (key, newValue) => {
      localStorage.setItem(key, newValue);
    },
    removeItem: (key) => {
      localStorage.removeItem(key);
    },
    subscribe: (key, callback, initialValue) => {
      const listener = (event: StorageEvent) => {
        if (event.storageArea === localStorage && event.key === key)
          callback(isTheme(event.newValue) ? event.newValue : initialValue);
      };
      addEventListener("storage", listener);
      return () => {
        removeEventListener("storage", listener);
      };
    },
  },
  {
    getOnInit: true,
  },
);
