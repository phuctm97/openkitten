import { describe, expect, it } from "vitest";
import { formatMessage } from "~/lib/format-message";

describe("formatMessage", () => {
  // --- Empty / trivial input ---

  it("returns empty array for empty input", () => {
    expect(formatMessage("")).toEqual([]);
    expect(formatMessage("   ")).toEqual([]);
  });

  it("formats simple text with MarkdownV2", () => {
    const result = formatMessage("Hello world");
    expect(result).toHaveLength(1);
    expect(result[0]?.formatted).toBe(true);
  });

  // --- Markdown formatting ---

  it("handles bold and italic markdown", () => {
    const result = formatMessage("This is **bold** and *italic* text");
    expect(result).toHaveLength(1);
    expect(result[0]?.formatted).toBe(true);
    expect(result[0]?.text).toContain("bold");
  });

  it("handles code blocks in formatted output", () => {
    const text = "Here is code:\n\n```js\nconst x = 1;\n```";
    const result = formatMessage(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]?.formatted).toBe(true);
  });

  // --- Horizontal rule splitting ---

  it("splits on horizontal rules into separate messages", () => {
    const text = "Section one.\n\n---\n\nSection two.";
    const result = formatMessage(text);
    expect(result.length).toBe(2);
    expect(result[0]?.text).toContain("Section one");
    expect(result[1]?.text).toContain("Section two");
  });

  it("splits on various HR patterns", () => {
    for (const hr of ["---", "___", "***"]) {
      const text = `Before.\n\n${hr}\n\nAfter.`;
      const result = formatMessage(text);
      expect(result.length).toBe(2);
    }
  });

  it("skips empty sections from HR splits", () => {
    const text = "---\n\nContent here.\n\n---";
    const result = formatMessage(text);
    expect(result.length).toBe(1);
    expect(result[0]?.text).toContain("Content here");
  });

  // --- Long text chunking ---

  it("handles long text that needs chunking", () => {
    const paragraph = "This is a sentence. ".repeat(200);
    const result = formatMessage(paragraph);
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(4096);
    }
  });

  it("preserves all content across chunks", () => {
    const words = Array.from({ length: 500 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const result = formatMessage(text);
    const reassembled = result.map((c) => c.text).join(" ");
    for (const word of words) {
      expect(reassembled).toContain(word);
    }
  });

  // --- Fallback ---

  it("falls back to plain text when conversion fails", () => {
    const weirdText = `${"```\n".repeat(50)}content${"\n```".repeat(50)}`;
    const result = formatMessage(weirdText);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  // --- Chunk shape ---

  it("returns all chunks as MessageChunk objects", () => {
    const text = "Hello **world**";
    const result = formatMessage(text);
    for (const chunk of result) {
      expect(chunk).toHaveProperty("text");
      expect(chunk).toHaveProperty("formatted");
      expect(typeof chunk.text).toBe("string");
      expect(typeof chunk.formatted).toBe("boolean");
    }
  });
});
