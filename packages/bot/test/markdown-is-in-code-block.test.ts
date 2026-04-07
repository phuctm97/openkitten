import { expect, test } from "vitest";
import { markdownIsInCodeBlock } from "~/lib/markdown-is-in-code-block";

test("returns the containing range when a position is inside a code block", () => {
  const ranges = [{ start: 7, end: 28, lang: "ts" }] as const;

  expect(markdownIsInCodeBlock(12, ranges)).toEqual(ranges[0]);
});

test("returns null when a position is outside all code blocks", () => {
  const ranges = [{ start: 7, end: 28, lang: "ts" }] as const;

  expect(markdownIsInCodeBlock(3, ranges)).toBeNull();
  expect(markdownIsInCodeBlock(30, ranges)).toBeNull();
});
