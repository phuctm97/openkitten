import { expect, test } from "vitest";
import { markdownFindCodeBlockRanges } from "~/lib/markdown-find-code-block-ranges";

test("finds closed markdown code block ranges", () => {
  expect(
    markdownFindCodeBlockRanges("before\n```ts\nconst x = 1;\n```\nafter"),
  ).toEqual([
    {
      start: 7,
      end: 29,
      lang: "ts",
    },
  ]);
});

test("treats an unclosed markdown code block as open to the end", () => {
  expect(markdownFindCodeBlockRanges("before\n```js\nconsole.log(1);")).toEqual(
    [
      {
        start: 7,
        end: 28,
        lang: "js",
      },
    ],
  );
});
