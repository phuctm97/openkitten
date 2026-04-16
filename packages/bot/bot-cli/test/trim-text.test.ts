import { expect, test } from "vitest";
import { trimText } from "~/lib/trim-text";

test("returns trimmed text", () => {
  expect(trimText("  hello  ")).toBe("hello");
});

test("returns undefined for empty text", () => {
  expect(trimText("   ")).toBeUndefined();
  expect(trimText(undefined)).toBeUndefined();
});
