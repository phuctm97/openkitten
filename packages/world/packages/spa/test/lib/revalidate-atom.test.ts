import { createStore } from "jotai/vanilla";
import { afterEach, expect, test, vi } from "vitest";

import { queryClient } from "~/lib/query-client";
import { revalidateAtom } from "~/lib/revalidate-atom";
import { revalidatorAtom } from "~/lib/revalidator-atom";

afterEach(() => {
  vi.restoreAllMocks();
});

test("cancels in-flight queries, resets all queries, then revalidates the router in order", async () => {
  const store = createStore();
  const order: string[] = [];
  const cancelQueries = vi
    .spyOn(queryClient, "cancelQueries")
    .mockImplementation(async () => {
      order.push("cancel");
    });
  const resetQueries = vi
    .spyOn(queryClient, "resetQueries")
    .mockImplementation(async () => {
      order.push("reset");
    });
  const revalidate = vi.fn(async () => {
    order.push("revalidate");
  });

  store.set(revalidatorAtom, { revalidate, state: "idle" });
  await store.set(revalidateAtom);

  expect(cancelQueries).toHaveBeenCalledWith();
  expect(resetQueries).toHaveBeenCalledWith();
  expect(revalidate).toHaveBeenCalledTimes(1);
  expect(order).toEqual(["cancel", "reset", "revalidate"]);
});

test("propagates a rejection from the router revalidator", async () => {
  const store = createStore();
  vi.spyOn(queryClient, "cancelQueries").mockResolvedValue();
  vi.spyOn(queryClient, "resetQueries").mockResolvedValue();
  const error = new Error("loader failed");
  store.set(revalidatorAtom, {
    revalidate: vi.fn(async () => {
      throw error;
    }),
    state: "idle",
  });
  await expect(store.set(revalidateAtom)).rejects.toBe(error);
});

test("propagates a rejection from queryClient.resetQueries", async () => {
  const store = createStore();
  vi.spyOn(queryClient, "cancelQueries").mockResolvedValue();
  const error = new Error("reset failed");
  vi.spyOn(queryClient, "resetQueries").mockRejectedValue(error);
  store.set(revalidatorAtom, {
    revalidate: vi.fn(async () => {}),
    state: "idle",
  });
  await expect(store.set(revalidateAtom)).rejects.toBe(error);
});

test("propagates a rejection from queryClient.cancelQueries", async () => {
  const store = createStore();
  const error = new Error("cancel failed");
  vi.spyOn(queryClient, "cancelQueries").mockRejectedValue(error);
  store.set(revalidatorAtom, {
    revalidate: vi.fn(async () => {}),
    state: "idle",
  });
  await expect(store.set(revalidateAtom)).rejects.toBe(error);
});
