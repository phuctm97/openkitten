import { createStore } from "jotai/vanilla";
import { expect, test, vi } from "vitest";

import { revalidateAtom } from "~/lib/revalidate-atom";
import { revalidatorAtom } from "~/lib/revalidator-atom";

test("revalidates through the router revalidator atom", async () => {
  const store = createStore();
  const revalidate = vi.fn(async () => {});

  store.set(revalidatorAtom, {
    revalidate,
    state: "idle",
  });

  await store.set(revalidateAtom);

  expect(revalidate).toHaveBeenCalledTimes(1);
});
