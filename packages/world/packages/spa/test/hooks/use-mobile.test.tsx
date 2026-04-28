import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { useIsMobile } from "~/hooks/use-mobile";

type MatchMediaChangeEvent = Event &
  Pick<MediaQueryListEvent, "matches" | "media">;
type MatchMediaListener = (event: MediaQueryListEvent) => void;

function stubViewport(width: number) {
  const listeners = new Set<MatchMediaListener>();
  let innerWidth = width;

  vi.stubGlobal("innerWidth", innerWidth);
  vi.stubGlobal("matchMedia", (query: string) => {
    const mediaQueryList: MediaQueryList = {
      get matches() {
        return innerWidth < 768;
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
    resize(nextWidth: number) {
      innerWidth = nextWidth;
      vi.stubGlobal("innerWidth", innerWidth);

      const event = Object.assign(new Event("change"), {
        matches: innerWidth < 768,
        media: "(max-width: 767px)",
      }) satisfies MatchMediaChangeEvent;

      for (const listener of listeners) {
        listener(event);
      }
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

test("tracks whether the viewport is mobile", () => {
  const viewport = stubViewport(1024);
  const { result } = renderHook(() => useIsMobile());

  expect(result.current).toBe(false);

  act(() => {
    viewport.resize(480);
  });

  expect(result.current).toBe(true);
});

test("removes the media query listener on unmount", () => {
  const viewport = stubViewport(480);
  const { unmount } = renderHook(() => useIsMobile());

  expect(viewport.listenerCount).toBe(1);

  unmount();

  expect(viewport.listenerCount).toBe(0);
});
