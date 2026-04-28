import { atom } from "jotai";
import { createStore } from "jotai/vanilla";
import { expect, test, vi } from "vitest";

import { atomWithWriteOnly } from "~/lib/atom-with-write-only";

test("returns a self-setter from the read side and delegates writes", () => {
  const store = createStore();
  const countAtom = atom(0);
  const writeSpy = vi.fn((get, set, amount: number) => {
    set(countAtom, get(countAtom) + amount);
  });
  const writeOnlyAtom = atomWithWriteOnly(writeSpy);

  expect(typeof store.get(writeOnlyAtom)).toBe("function");

  store.set(writeOnlyAtom, 3);

  expect(writeSpy).toHaveBeenCalledTimes(1);
  expect(store.get(countAtom)).toBe(3);
});
