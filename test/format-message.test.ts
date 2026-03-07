import { convert } from "telegram-markdown-v2";
import { expect, test, vi } from "vitest";
import { formatMessage } from "~/lib/format-message";

vi.mock("telegram-markdown-v2", { spy: true });

test("returns empty array for empty input", () => {
  expect(formatMessage("")).toEqual([]);
  expect(formatMessage("   ")).toEqual([]);
});

test("formats simple text with MarkdownV2", () => {
  const result = formatMessage("Hello world");
  expect(result).toHaveLength(1);
  expect(result[0]?.formatted).toBe(true);
});

test("handles bold and italic markdown", () => {
  const result = formatMessage("This is **bold** and *italic* text");
  expect(result).toHaveLength(1);
  expect(result[0]?.formatted).toBe(true);
  expect(result[0]?.text).toContain("bold");
});

test("handles code blocks in formatted output", () => {
  const text = "Here is code:\n\n```js\nconst x = 1;\n```";
  const result = formatMessage(text);
  expect(result.length).toBeGreaterThanOrEqual(1);
  expect(result[0]?.formatted).toBe(true);
});

test("splits on horizontal rules into separate messages", () => {
  const text = "Section one.\n\n---\n\nSection two.";
  const result = formatMessage(text);
  expect(result.length).toBe(2);
  expect(result[0]?.text).toContain("Section one");
  expect(result[1]?.text).toContain("Section two");
});

test("splits on various HR patterns", () => {
  for (const hr of ["---", "___", "***"]) {
    const text = `Before.\n\n${hr}\n\nAfter.`;
    const result = formatMessage(text);
    expect(result.length).toBe(2);
  }
});

test("skips empty sections from HR splits", () => {
  const text = "---\n\nContent here.\n\n---";
  const result = formatMessage(text);
  expect(result.length).toBe(1);
  expect(result[0]?.text).toContain("Content here");
});

test("handles long text that needs chunking", () => {
  const paragraph = "This is a sentence. ".repeat(200);
  const result = formatMessage(paragraph);
  expect(result.length).toBeGreaterThan(1);
  for (const chunk of result) {
    expect(chunk.text.length).toBeLessThanOrEqual(4096);
  }
});

test("preserves all content across chunks", () => {
  const words = Array.from({ length: 500 }, (_, i) => `word${i}`);
  const text = words.join(" ");
  const result = formatMessage(text);
  const reassembled = result.map((c) => c.text).join(" ");
  for (const word of words) {
    expect(reassembled).toContain(word);
  }
});

test("splits large code blocks with close/reopen fences", () => {
  const lines = Array.from({ length: 200 }, (_, i) => `  const v${i} = ${i};`);
  const text = `\`\`\`typescript\n${lines.join("\n")}\n\`\`\``;
  const result = formatMessage(text);
  expect(result.length).toBeGreaterThan(1);
  for (const chunk of result) {
    expect(chunk.text.length).toBeLessThanOrEqual(4096);
  }
});

test("handles overflow when MarkdownV2 escaping expands beyond limit", () => {
  const text = "!.()_~`>#+-=|{}.!".repeat(200);
  const result = formatMessage(text);
  expect(result.length).toBeGreaterThanOrEqual(1);
  for (const chunk of result) {
    expect(chunk.text.length).toBeLessThanOrEqual(4096);
  }
});

test("handles unclosed code blocks", () => {
  const text = `\`\`\`python\n${"x = 1\n".repeat(600)}`;
  const result = formatMessage(text);
  expect(result.length).toBeGreaterThanOrEqual(1);
  for (const chunk of result) {
    expect(chunk.text.length).toBeLessThanOrEqual(4096);
  }
});

test("hard cuts when no natural split points exist", () => {
  const text = "x".repeat(4000);
  const result = formatMessage(text);
  expect(result.length).toBeGreaterThanOrEqual(1);
  for (const chunk of result) {
    expect(chunk.text.length).toBeLessThanOrEqual(4096);
  }
});

test("falls back to plain text when convert throws", () => {
  vi.mocked(convert).mockImplementation(() => {
    throw new Error("conversion failed");
  });
  const result = formatMessage("Hello world");
  expect(result).toEqual([{ text: "Hello world", formatted: false }]);
  vi.mocked(convert).mockRestore();
});

test("falls back to plain text when sub-chunk still overflows", () => {
  vi.mocked(convert).mockReturnValue("x".repeat(5000));
  const result = formatMessage("Hello world");
  expect(result.length).toBeGreaterThanOrEqual(1);
  for (const chunk of result) {
    expect(chunk.formatted).toBe(false);
  }
  vi.mocked(convert).mockRestore();
});

test("falls back when sub-chunk convert throws", () => {
  let callCount = 0;
  vi.mocked(convert).mockImplementation(() => {
    callCount++;
    if (callCount === 1) return "x".repeat(5000);
    throw new Error("sub-chunk failed");
  });
  const result = formatMessage("Hello world");
  expect(result.length).toBeGreaterThanOrEqual(1);
  for (const chunk of result) {
    expect(chunk.formatted).toBe(false);
  }
  vi.mocked(convert).mockRestore();
});

test("returns all chunks as MessageChunk objects", () => {
  const text = "Hello **world**";
  const result = formatMessage(text);
  for (const chunk of result) {
    expect(chunk).toHaveProperty("text");
    expect(chunk).toHaveProperty("formatted");
    expect(typeof chunk.text).toBe("string");
    expect(typeof chunk.formatted).toBe("boolean");
  }
});
