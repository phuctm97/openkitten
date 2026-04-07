import { expect, test } from "vitest";
import { markdownHrPattern } from "~/lib/markdown-hr-pattern";

test("matches markdown horizontal rules on their own lines", () => {
  expect(markdownHrPattern.test("before\n---\nafter")).toBe(true);
  expect(markdownHrPattern.test("before\n***\nafter")).toBe(true);
  expect(markdownHrPattern.test("before\n___\nafter")).toBe(true);
});

test("does not match plain text lines", () => {
  expect(markdownHrPattern.test("before\nhello\nafter")).toBe(false);
});
