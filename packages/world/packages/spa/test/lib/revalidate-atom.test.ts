import { createStore } from "jotai/vanilla";
import { expect, test, vi } from "vitest";

import { queryClient } from "~/lib/query-client";
import { revalidateAtom } from "~/lib/revalidate-atom";
import { revalidatorAtom } from "~/lib/revalidator-atom";

test("revalidates through the router revalidator and resets all queries", async () => {
  const store = createStore();
  const revalidate = vi.fn(async () => {});
  const resetQueries = vi
    .spyOn(queryClient, "resetQueries")
    .mockResolvedValue();

  store.set(revalidatorAtom, {
    revalidate,
    state: "idle",
  });

  await store.set(revalidateAtom);

  expect(revalidate).toHaveBeenCalledTimes(1);
  expect(resetQueries).toHaveBeenCalledTimes(1);
  expect(resetQueries).toHaveBeenCalledWith();
});
