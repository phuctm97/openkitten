import { expect, test } from "vitest";
import { cleanMimeType } from "~/lib/clean-mime-type";

test("normalizes mime type casing and parameters", () => {
  expect(cleanMimeType("  Image/PNG; charset=utf-8  ")).toBe("image/png");
});

test("returns normalized mime types without parameters", () => {
  expect(cleanMimeType("TEXT/PLAIN")).toBe("text/plain");
});

test("returns undefined for blank mime types", () => {
  expect(cleanMimeType("   ")).toBeUndefined();
  expect(cleanMimeType(undefined)).toBeUndefined();
});
