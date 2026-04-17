import { atom } from "jotai";

const hydrationEventType = "openkitten:hydration";

const hydrationPromise = new Promise<void>((resolve) => {
  if (import.meta.env.SSR) {
    return;
  }

  addEventListener(
    hydrationEventType,
    () => {
      resolve();
    },
    { once: true },
  );
});

export const hydrationAtom = atom(hydrationPromise, () => {
  if (import.meta.env.SSR) {
    return;
  }

  dispatchEvent(new CustomEvent(hydrationEventType));
});
