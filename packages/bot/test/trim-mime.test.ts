import { expect, test } from "vitest";
import { trimMime } from "~/lib/trim-mime";

test("normalizes mime type casing and parameters", () => {
  expect(trimMime("  Image/PNG; charset=utf-8  ")).toBe("image/png");
});

test("returns normalized mime types without parameters", () => {
  expect(trimMime("TEXT/PLAIN")).toBe("text/plain");
});

test("returns undefined for blank mime types", () => {
  expect(trimMime("   ")).toBeUndefined();
  expect(trimMime(undefined)).toBeUndefined();
});
