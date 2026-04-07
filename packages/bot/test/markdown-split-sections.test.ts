import { expect, test } from "vitest";
import { markdownSplitSections } from "~/lib/markdown-split-sections";

test("splits sections on markdown horizontal rules outside code blocks", () => {
  expect(markdownSplitSections("Before\n\n---\n\nAfter")).toEqual([
    "Before\n",
    "\nAfter",
  ]);
});

test("does not split on markdown horizontal rules inside code blocks", () => {
  expect(markdownSplitSections("```txt\n---\nhello\n```")).toEqual([
    "```txt\n---\nhello\n```",
  ]);
});
