import { expect, test, vi } from "vitest";

import { normalizeCallback } from "~/lib/normalize-callback";

test("returns root for missing callbacks", () => {
  expect(normalizeCallback()).toBe("/");
  expect(normalizeCallback(null)).toBe("/");
  expect(normalizeCallback("")).toBe("/");
});

test("returns the path, search and hash for valid URLs", () => {
  vi.stubGlobal("location", { origin: "https://world.openkitten.dev" });

  expect(normalizeCallback("/app?tab=home#anchor")).toBe(
    "/app?tab=home#anchor",
  );
  expect(
    normalizeCallback("https://world.openkitten.dev/app?tab=home#anchor"),
  ).toBe("/app?tab=home#anchor");

  vi.unstubAllGlobals();
});

test("returns root for invalid URLs", () => {
  vi.stubGlobal("location", { origin: "" });

  expect(normalizeCallback("::not-a-url")).toBe("/");

  vi.unstubAllGlobals();
});
