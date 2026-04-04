import { expect, test } from "vitest";
import { cleanText } from "~/lib/clean-text";

test("returns trimmed text", () => {
  expect(cleanText("  hello  ")).toBe("hello");
});

test("returns undefined for empty text", () => {
  expect(cleanText("   ")).toBeUndefined();
  expect(cleanText(undefined)).toBeUndefined();
});
