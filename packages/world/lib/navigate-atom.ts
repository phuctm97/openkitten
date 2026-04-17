import type { Location, NavigateOptions, Path, To } from "react-router";

import { atomWithWriteOnly } from "~/lib/atom-with-write-only";
import { locationAtom } from "~/lib/location-atom";
import { navigationCountAtom } from "~/lib/navigation-count-atom";
import { navigatorAtom } from "~/lib/navigator-atom";

const defaultWaitInterval = 50;

const defaultWaitTimeout = 10_000;

interface WaitOptions {
  interval?: number;
  timeout?: number;
}

interface NavigationOptions extends NavigateOptions {
  navigationCount?: number;
  wait?: boolean | number | WaitOptions;
}

function matchesLocation(to: Partial<Path>, location: Location) {
  const keys = Object.keys(to) as Array<keyof Path>;

  return keys.every((key) => location[key] === to[key]);
}

function getWaitOptions(wait: NavigationOptions["wait"]) {
  if (!wait) {
    return null;
  }

  if (typeof wait === "number") {
    return { interval: wait, timeout: defaultWaitTimeout };
  }

  if (typeof wait === "object") {
    return {
      interval: wait.interval ?? defaultWaitInterval,
      timeout: wait.timeout ?? defaultWaitTimeout,
    };
  }

  return { interval: defaultWaitInterval, timeout: defaultWaitTimeout };
}

export const navigateAtom = atomWithWriteOnly(
  async (get, _, to: To, options: NavigationOptions = {}) => {
    const { navigationCount, wait, ...navigateOptions } = options;

    if (
      typeof navigationCount === "number" &&
      navigationCount !== get(navigationCountAtom)
    ) {
      return;
    }

    const navigator = get(navigatorAtom);
    await navigator.navigate(to, navigateOptions);

    const waitOptions = getWaitOptions(wait);

    if (!waitOptions) {
      return;
    }

    await new Promise<void>((resolve) => {
      const cleanup = () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };

      const intervalId = setInterval(() => {
        const location = get(locationAtom);

        if (
          (typeof to === "string" && location.pathname === to) ||
          (typeof to === "object" && matchesLocation(to, location))
        ) {
          cleanup();
          resolve();
        }
      }, waitOptions.interval);

      const timeoutId = setTimeout(() => {
        cleanup();
        resolve();
      }, waitOptions.timeout);
    });
  },
);
