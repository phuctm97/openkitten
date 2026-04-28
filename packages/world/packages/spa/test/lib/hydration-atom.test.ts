import { createStore } from "jotai/vanilla";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test("resolves after hydration is signaled on the client", async () => {
  vi.stubEnv("SSR", false);

  const { hydrationAtom } = await import("~/lib/hydration-atom");
  const store = createStore();
  const hydrationPromise = store.get(hydrationAtom);

  store.set(hydrationAtom);

  await expect(hydrationPromise).resolves.toBeUndefined();
});

test("does not dispatch a hydration event on the server", async () => {
  vi.stubEnv("SSR", true);

  const dispatchEventSpy = vi.spyOn(globalThis, "dispatchEvent");
  const { hydrationAtom } = await import("~/lib/hydration-atom");
  const store = createStore();

  void store.get(hydrationAtom);
  store.set(hydrationAtom);

  expect(dispatchEventSpy).not.toHaveBeenCalled();
});
