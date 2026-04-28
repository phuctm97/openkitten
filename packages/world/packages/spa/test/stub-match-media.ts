import { vi } from "vitest";

import type { ColorScheme } from "~/lib/color-scheme";

type MatchMediaChangeEvent = Event &
  Pick<MediaQueryListEvent, "matches" | "media">;
type MatchMediaListener = (event: MediaQueryListEvent) => void;

export function stubMatchMedia(initialColorScheme: ColorScheme) {
  const mediaQuery = "(prefers-color-scheme: dark)";
  const listeners = new Set<MatchMediaListener>();
  let colorScheme = initialColorScheme;

  vi.stubGlobal("matchMedia", (query: string) => {
    const mediaQueryList: MediaQueryList = {
      get matches() {
        return query === mediaQuery && colorScheme === "dark";
      },
      media: query,
      onchange: null,
      addEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        if (typeof listener === "function") {
          listeners.add(listener as MatchMediaListener);
        }
      },
      removeEventListener: (
        _type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        if (typeof listener === "function") {
          listeners.delete(listener as MatchMediaListener);
        }
      },
      addListener: (listener: MatchMediaListener) => {
        listeners.add(listener);
      },
      removeListener: (listener: MatchMediaListener) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => true,
    };

    return mediaQueryList;
  });

  return {
    setColorScheme(value: ColorScheme) {
      colorScheme = value;

      const event = Object.assign(new Event("change"), {
        matches: value === "dark",
        media: mediaQuery,
      }) satisfies MatchMediaChangeEvent;

      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}
