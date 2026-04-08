import { RESET } from "jotai/utils";
import { createStore } from "jotai/vanilla";
import { expect, test, vi } from "vitest";

async function importThemeAtom() {
  vi.resetModules();

  const themeAtomModule = await import("~/lib/theme-atom");

  return themeAtomModule.themeAtom;
}

test("returns the initial theme during SSR", async () => {
  vi.stubEnv("SSR", true);
  localStorage.setItem("openkitten-theme", "dark");

  expect(createStore().get(await importThemeAtom())).toBe("auto");
});

test("reads valid themes from localStorage and rejects invalid ones", async () => {
  localStorage.setItem("openkitten-theme", "dark");

  expect(createStore().get(await importThemeAtom())).toBe("dark");

  localStorage.setItem("openkitten-theme", "sunset");

  expect(createStore().get(await importThemeAtom())).toBe("auto");
});

test("writes and removes theme values in localStorage", async () => {
  const themeAtom = await importThemeAtom();
  const store = createStore();

  store.set(themeAtom, "light");
  expect(localStorage.getItem("openkitten-theme")).toBe("light");

  store.set(themeAtom, RESET);
  expect(localStorage.getItem("openkitten-theme")).toBeNull();
  expect(store.get(themeAtom)).toBe("auto");
});

test("subscribes to storage changes for the matching key", async () => {
  const themeAtom = await importThemeAtom();
  const store = createStore();
  const listener = vi.fn();
  const unsubscribe = store.sub(themeAtom, listener);

  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "another-key",
      newValue: "dark",
      storageArea: localStorage,
    }),
  );
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "openkitten-theme",
      newValue: "light",
      storageArea: sessionStorage,
    }),
  );

  expect(listener).not.toHaveBeenCalled();

  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "openkitten-theme",
      newValue: "dark",
      storageArea: localStorage,
    }),
  );

  expect(listener).toHaveBeenCalledTimes(1);
  expect(store.get(themeAtom)).toBe("dark");

  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "openkitten-theme",
      newValue: "sunset",
      storageArea: localStorage,
    }),
  );

  expect(listener).toHaveBeenCalledTimes(2);
  expect(store.get(themeAtom)).toBe("auto");

  unsubscribe();
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "openkitten-theme",
      newValue: "light",
      storageArea: localStorage,
    }),
  );

  expect(listener).toHaveBeenCalledTimes(2);
});
