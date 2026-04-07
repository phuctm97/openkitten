import { expect, test } from "vitest";
import { markdownAlignCodeBlockTrimStart } from "~/lib/markdown-align-code-block-trim-start";

const codeBlockRange = (text: string) => ({
  start: 0,
  end: text.length,
  lang: "txt",
});

test("advances to the next line when trimming in the middle of a code line", () => {
  const text = `\`\`\`txt\n${"a".repeat(5000)}\nshort\n\`\`\``;
  const start = markdownAlignCodeBlockTrimStart(
    text,
    4096,
    0,
    codeBlockRange(text),
  );

  expect(text.slice(start)).toBe("short\n```");
});

test("keeps the current offset when there is no later line to advance to", () => {
  const text = `\`\`\`txt\n${"y".repeat(5000)}\`\`\``;
  const start = markdownAlignCodeBlockTrimStart(
    text,
    4096,
    0,
    codeBlockRange(text),
  );

  expect(text[start]).toBe("y");
});

test("skips blank lines after advancing to the next line", () => {
  const text = `\`\`\`txt\n${"a".repeat(5000)}\n\nshort\n\`\`\``;
  const start = markdownAlignCodeBlockTrimStart(
    text,
    4096,
    0,
    codeBlockRange(text),
  );

  expect(text.slice(start)).toBe("short\n```");
});
