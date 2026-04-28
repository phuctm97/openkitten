import { atom } from "jotai";
import { createStore } from "jotai/vanilla";
import { expect, test } from "vitest";

import { atomWithReadOnly } from "~/lib/atom-with-read-only";

test("reads from the wrapped writable atom", () => {
  const store = createStore();
  const countAtom = atom(1);
  const readOnlyAtom = atomWithReadOnly(countAtom);

  expect(store.get(readOnlyAtom)).toBe(1);

  store.set(countAtom, 2);

  expect(store.get(readOnlyAtom)).toBe(2);
});
