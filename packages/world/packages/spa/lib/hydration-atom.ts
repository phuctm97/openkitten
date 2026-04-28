import { randomId } from "@mantine/hooks";
import { atom } from "jotai";

const hydrationEvent = randomId();

const hydrationPromise = new Promise<void>((resolve) => {
  if (import.meta.env.SSR) {
    return;
  }

  addEventListener(
    hydrationEvent,
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

  dispatchEvent(new CustomEvent(hydrationEvent));
});
