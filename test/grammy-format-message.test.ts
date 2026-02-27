import { convert } from "telegram-markdown-v2";
import { assert, expect, test, vi } from "vitest";
import { grammyFormatMessage } from "~/lib/grammy-format-message";
import { logger } from "~/lib/logger";

vi.mock("telegram-markdown-v2", { spy: true });

test("returns empty array for empty input", () => {
  expect(grammyFormatMessage("")).toEqual([]);
  expect(grammyFormatMessage("   ")).toEqual([]);
});

test("formats simple text with MarkdownV2", () => {
  const result = grammyFormatMessage("Hello world");
  expect(result).toHaveLength(1);
  expect(result[0]?.text).toBe("Hello world");
  assert.isDefined(result[0]?.markdown);
});

test("handles bold and italic markdown", () => {
  const result = grammyFormatMessage("This is **bold** and *italic* text");
  expect(result).toHaveLength(1);
  expect(result[0]?.markdown).toContain("bold");
});

test("preserves code block language in formatted output", () => {
  const text = "Here is code:\n\n```js\nconst x = 1;\n```";
  const result = grammyFormatMessage(text);
  expect(result.length).toBeGreaterThanOrEqual(1);
  assert.isDefined(result[0]?.markdown);
  expect(result[0].markdown).toContain("```js\n");
});

test("splits on horizontal rules into separate messages", () => {
  const text = "Section one.\n\n---\n\nSection two.";
  const result = grammyFormatMessage(text);
  expect(result.length).toBe(2);
  expect(result[0]?.text).toContain("Section one");
  expect(result[1]?.text).toContain("Section two");
});

test("splits on various HR patterns", () => {
  for (const hr of ["---", "___", "***"]) {
    const text = `Before.\n\n${hr}\n\nAfter.`;
    const result = grammyFormatMessage(text);
    expect(result.length).toBe(2);
  }
});

test("skips empty sections from HR splits", () => {
  const text = "---\n\nContent here.\n\n---";
  const result = grammyFormatMessage(text);
  expect(result.length).toBe(1);
  expect(result[0]?.text).toContain("Content here");
  assert.isDefined(result[0]?.markdown);
});

test("handles long text that needs chunking", () => {
  const paragraph = "This is a sentence. ".repeat(200);
  const result = grammyFormatMessage(paragraph);
  expect(result.length).toBeGreaterThan(1);
  for (const chunk of result) {
    expect((chunk.markdown ?? chunk.text).length).toBeLessThanOrEqual(4096);
  }
});

test("preserves all content across chunks", () => {
  const words = Array.from({ length: 500 }, (_, i) => `word${i}`);
  const text = words.join(" ");
  const result = grammyFormatMessage(text);
  const reassembled = result.map((c) => c.text).join(" ");
  for (const word of words) {
    expect(reassembled).toContain(word);
  }
});

test("splits text with a short code block followed by long content", () => {
  const text = `Intro.\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n\n${"Word. ".repeat(600)}`;
  const result = grammyFormatMessage(text);
  expect(result.length).toBeGreaterThan(1);
  for (const chunk of result) {
    expect((chunk.markdown ?? chunk.text).length).toBeLessThanOrEqual(4096);
  }
});

test("splits large code blocks with close/reopen fences", () => {
  const lines = Array.from({ length: 200 }, (_, i) => `  const v${i} = ${i};`);
  const text = `\`\`\`typescript\n${lines.join("\n")}\n\`\`\``;
  const result = grammyFormatMessage(text);
  expect(result.length).toBeGreaterThan(1);
  for (const chunk of result) {
    expect((chunk.markdown ?? chunk.text).length).toBeLessThanOrEqual(4096);
  }
});

test("handles overflow when MarkdownV2 escaping expands beyond limit", () => {
  const text = "!.()_~`>#+-=|{}.!".repeat(200);
  const result = grammyFormatMessage(text);
  expect(result.length).toBeGreaterThanOrEqual(1);
  for (const chunk of result) {
    expect((chunk.markdown ?? chunk.text).length).toBeLessThanOrEqual(4096);
  }
});

test("handles unclosed code blocks", () => {
  const text = `\`\`\`python\n${"x = 1\n".repeat(600)}`;
  const result = grammyFormatMessage(text);
  expect(result.length).toBeGreaterThanOrEqual(1);
  for (const chunk of result) {
    expect((chunk.markdown ?? chunk.text).length).toBeLessThanOrEqual(4096);
  }
});

test("hard cuts when no natural split points exist", () => {
  const text = "x".repeat(4000);
  const result = grammyFormatMessage(text);
  expect(result.length).toBeGreaterThanOrEqual(1);
  for (const chunk of result) {
    expect((chunk.markdown ?? chunk.text).length).toBeLessThanOrEqual(4096);
  }
});

test("hard cuts code block with no usable newline", () => {
  const text = `\`\`\`js\n${"x".repeat(4000)}\n\`\`\``;
  const result = grammyFormatMessage(text);
  expect(result.length).toBeGreaterThan(1);
});

test("falls back to plain text when convert throws", () => {
  vi.mocked(convert).mockImplementationOnce(() => {
    throw new Error("conversion failed");
  });
  const result = grammyFormatMessage("Hello world");
  expect(result).toEqual([{ text: "Hello world" }]);
  expect(logger.warn).toHaveBeenCalledWith(
    "Failed to format as MarkdownV2",
    expect.any(Error),
    { chunk: "Hello world" },
  );
});

test("falls back to plain text when sub-chunk still overflows", () => {
  vi.mocked(convert).mockReturnValue("x".repeat(5000));
  const result = grammyFormatMessage("Hello world");
  expect(result.length).toBeGreaterThanOrEqual(1);
  for (const chunk of result) {
    assert.isUndefined(chunk.markdown);
  }
});

test("falls back when sub-chunk convert throws", () => {
  vi.mocked(convert)
    .mockReturnValueOnce("x".repeat(5000))
    .mockImplementation(() => {
      throw new Error("sub-chunk failed");
    });
  const result = grammyFormatMessage("Hello world");
  expect(result.length).toBeGreaterThanOrEqual(1);
  for (const chunk of result) {
    assert.isUndefined(chunk.markdown);
  }
});
