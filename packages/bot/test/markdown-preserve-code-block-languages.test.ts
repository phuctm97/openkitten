import { expect, test } from "vitest";
import { markdownPreserveCodeBlockLanguages } from "~/lib/markdown-preserve-code-block-languages";

test("restores source code block languages onto converted fences", () => {
  expect(
    markdownPreserveCodeBlockLanguages(
      "```ts\nconst x = 1;\n```",
      "```\nconst x = 1;\n```",
    ),
  ).toBe("```ts\nconst x = 1;\n```");
});

test("returns the text unchanged when there are no code block languages", () => {
  expect(markdownPreserveCodeBlockLanguages("hello", "hello")).toBe("hello");
});
