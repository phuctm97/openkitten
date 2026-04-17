import { createStore } from "jotai/vanilla";
import { afterEach, expect, test, vi } from "vitest";

import { locationAtom } from "~/lib/location-atom";
import { navigateAtom } from "~/lib/navigate-atom";
import { navigationCountAtom } from "~/lib/navigation-count-atom";
import { navigatorAtom } from "~/lib/navigator-atom";

function createLocation(pathname: string, search = "", hash = "") {
  return {
    hash,
    key: `${pathname}${search}${hash}`,
    pathname,
    search,
    state: null,
    unstable_mask: undefined,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

test("skips navigation when the navigation count has changed", async () => {
  const store = createStore();
  const navigate = vi.fn();

  store.set(navigatorAtom, { navigate });
  store.set(navigationCountAtom, 2);

  await store.set(navigateAtom, "/game", { navigationCount: 1 });

  expect(navigate).not.toHaveBeenCalled();
});

test("navigates immediately when waiting is disabled", async () => {
  const store = createStore();
  const navigate = vi.fn(async () => {});

  store.set(navigatorAtom, { navigate });

  await store.set(navigateAtom, "/game", { replace: true });

  expect(navigate).toHaveBeenCalledWith("/game", { replace: true });
});

test("uses default navigation options when none are provided", async () => {
  const store = createStore();
  const navigate = vi.fn(async () => {});

  store.set(navigatorAtom, { navigate });

  await store.set(navigateAtom, "/game");

  expect(navigate).toHaveBeenCalledWith("/game", {});
});

test("waits for a string destination to become active", async () => {
  vi.useFakeTimers();

  const store = createStore();
  const nextLocation = createLocation("/game");
  const navigate = vi.fn(async () => {
    setTimeout(() => {
      store.set(locationAtom, nextLocation);
    }, 10);
  });

  store.set(locationAtom, createLocation("/"));
  store.set(navigatorAtom, { navigate });

  const navigationPromise = store.set(navigateAtom, "/game", { wait: 5 });

  await vi.advanceTimersByTimeAsync(10);
  await navigationPromise;

  expect(navigate).toHaveBeenCalledWith("/game", {});
});

test("waits for a partial path destination to match the location", async () => {
  vi.useFakeTimers();

  const store = createStore();
  const destination = { pathname: "/app", search: "?tab=home" };
  const navigate = vi.fn(async () => {
    setTimeout(() => {
      store.set(locationAtom, createLocation("/app", "?tab=home", "#hero"));
    }, 10);
  });

  store.set(locationAtom, createLocation("/"));
  store.set(navigatorAtom, { navigate });

  const navigationPromise = store.set(navigateAtom, destination, {
    wait: { interval: 5, timeout: 25 },
  });

  await vi.advanceTimersByTimeAsync(10);
  await navigationPromise;

  expect(navigate).toHaveBeenCalledWith(destination, {});
});

test("uses the default wait interval and timeout for object waits", async () => {
  vi.useFakeTimers();

  const store = createStore();
  const nextLocation = createLocation("/game");
  const navigate = vi.fn(async () => {
    setTimeout(() => {
      store.set(locationAtom, nextLocation);
    }, 60);
  });

  store.set(locationAtom, createLocation("/"));
  store.set(navigatorAtom, { navigate });

  const navigationPromise = store.set(navigateAtom, "/game", { wait: {} });

  await vi.advanceTimersByTimeAsync(100);
  await navigationPromise;

  expect(navigate).toHaveBeenCalledWith("/game", {});
});

test("stops waiting when the timeout is reached", async () => {
  vi.useFakeTimers();

  const store = createStore();
  const navigate = vi.fn(async () => {});

  store.set(locationAtom, createLocation("/"));
  store.set(navigatorAtom, { navigate });

  const navigationPromise = store.set(navigateAtom, "/game", { wait: true });

  await vi.advanceTimersByTimeAsync(10_000);
  await navigationPromise;

  expect(navigate).toHaveBeenCalledWith("/game", {});
});
