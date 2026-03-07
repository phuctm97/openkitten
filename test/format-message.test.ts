import { describe, expect, it } from "vitest";
import { formatMessage, splitMessage } from "~/lib/format-message";

describe("splitMessage", () => {
  it("returns single chunk when text is within limit", () => {
    expect(splitMessage("Hello world", 100)).toEqual(["Hello world"]);
  });

  it("returns single chunk when text equals limit", () => {
    const text = "x".repeat(100);
    expect(splitMessage(text, 100)).toEqual([text]);
  });

  it("returns single chunk for empty text", () => {
    expect(splitMessage("", 100)).toEqual([""]);
  });

  // --- Paragraph splitting ---

  it("splits at paragraph break (double newline)", () => {
    const text = "First paragraph.\n\nSecond paragraph.";
    const chunks = splitMessage(text, 20);
    expect(chunks).toEqual(["First paragraph.", "Second paragraph."]);
  });

  // --- Newline splitting ---

  it("splits at single newline when no paragraph break available", () => {
    const text = "Line one.\nLine two.\nLine three.";
    const chunks = splitMessage(text, 22);
    expect(chunks[0]).toBe("Line one.\nLine two.");
    expect(chunks[1]).toBe("Line three.");
  });

  // --- Sentence splitting ---

  it("splits at sentence ending", () => {
    const text = "First sentence. Second sentence. Third sentence.";
    const chunks = splitMessage(text, 35);
    expect(chunks[0]).toBe("First sentence. Second sentence.");
    expect(chunks[1]).toBe("Third sentence.");
  });

  // --- Word boundary splitting ---

  it("splits at word boundary (space)", () => {
    const text = "hello world foo bar baz";
    const chunks = splitMessage(text, 12);
    expect(chunks[0]).toBe("hello world");
    expect(chunks[1]).toBe("foo bar baz");
  });

  // --- Hard cut ---

  it("hard cuts when no split points exist", () => {
    const text = "x".repeat(200);
    const chunks = splitMessage(text, 100);
    expect(chunks).toEqual(["x".repeat(100), "x".repeat(100)]);
  });

  // --- Header splitting ---

  it("splits before markdown headers", () => {
    const text = "Some intro text.\n\n## Section One\n\nContent here.";
    const chunks = splitMessage(text, 35);
    expect(chunks[0]).toBe("Some intro text.");
    expect(chunks[1]).toBe("## Section One\n\nContent here.");
  });

  it("splits before horizontal rules", () => {
    const text = "First part.\n\n---\n\nSecond part.";
    const chunks = splitMessage(text, 20);
    expect(chunks[0]).toBe("First part.");
    expect(chunks[1]).toBe("---\n\nSecond part.");
  });

  // --- List item splitting ---

  it("splits before list items", () => {
    const text =
      "Intro:\n- Item one is somewhat long\n- Item two is also long\n- Item three here";
    const chunks = splitMessage(text, 42);
    expect(chunks[0]).toBe("Intro:\n- Item one is somewhat long");
    expect(chunks[1]).toMatch(/^- Item two/);
  });

  it("splits before numbered list items", () => {
    const text =
      "Steps:\n1. First step here\n2. Second step here\n3. Third step here";
    const chunks = splitMessage(text, 30);
    expect(chunks[0]).toBe("Steps:\n1. First step here");
    expect(chunks[1]).toMatch(/^2\. Second step/);
  });

  // --- Priority ordering ---

  it("prefers header over paragraph break", () => {
    const text = "Intro text here.\n\nParagraph.\n\n## Header\n\nContent.";
    const chunks = splitMessage(text, 40);
    expect(chunks[0]).toBe("Intro text here.\n\nParagraph.");
    expect(chunks[1]).toMatch(/^## Header/);
  });

  // --- Code block awareness ---

  it("does not split inside a code block when avoidable", () => {
    const text =
      "Text before.\n\n```js\nconst x = 1;\nconst y = 2;\n```\n\nText after.";
    const chunks = splitMessage(text, 50);
    expect(chunks.join("")).not.toContain("```\n```");
  });

  it("closes and reopens code block when block exceeds limit", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `const v${i} = ${i};`);
    const text = `\`\`\`typescript\n${lines.join("\n")}\n\`\`\``;
    const chunks = splitMessage(text, 100);
    expect(chunks[0]).toMatch(/```$/);
    expect(chunks[1]).toMatch(/^```typescript\n/);
  });

  it("preserves language tag when reopening code block", () => {
    const longCode = "x = 1\n".repeat(50);
    const text = `\`\`\`python\n${longCode}\`\`\``;
    const chunks = splitMessage(text, 100);
    expect(chunks[0]).toMatch(/```$/);
    expect(chunks[1]).toMatch(/^```python\n/);
  });

  it("preserves indentation when splitting inside code block", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `    line${i}();`);
    const text = `\`\`\`js\n${lines.join("\n")}\n\`\`\``;
    const chunks = splitMessage(text, 80);
    const secondChunkLines = chunks[1]?.split("\n");
    expect(secondChunkLines?.[1]).toMatch(/^ {4}/);
  });

  it("does not infinite loop when code block starts near position 0", () => {
    const text = `\`\`\`python\n${"x".repeat(200)}`;
    const chunks = splitMessage(text, 20);
    expect(chunks.length).toBeGreaterThan(1);
    const allText = chunks.join("");
    expect(allText).toContain("x".repeat(20));
  });

  // --- Whitespace trimming ---

  it("trims whitespace at split boundaries", () => {
    const text = "First part.   \n\n   Second part.";
    const chunks = splitMessage(text, 18);
    expect(chunks[0]).toBe("First part.");
    expect(chunks[1]).toBe("Second part.");
  });
});

describe("formatMessage", () => {
  it("returns empty array for empty input", () => {
    expect(formatMessage("")).toEqual([]);
    expect(formatMessage("   ")).toEqual([]);
  });

  it("formats simple text with MarkdownV2", () => {
    const result = formatMessage("Hello world");
    expect(result).toHaveLength(1);
    expect(result[0]?.formatted).toBe(true);
  });

  it("handles bold and italic markdown", () => {
    const result = formatMessage("This is **bold** and *italic* text");
    expect(result).toHaveLength(1);
    expect(result[0]?.formatted).toBe(true);
    expect(result[0]?.text).toContain("bold");
  });

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

  it("handles long text that needs chunking", () => {
    const paragraph = "This is a sentence. ".repeat(200);
    const result = formatMessage(paragraph);
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(4096);
    }
  });

  it("falls back to plain text when conversion fails", () => {
    // Construct text that triggers a conversion error by using
    // deeply nested/malformed markdown that the converter chokes on
    const weirdText = `${"```\n".repeat(50)}content${"\n```".repeat(50)}`;
    const result = formatMessage(weirdText);
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Should not throw — graceful fallback
  });

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

  it("handles code blocks in formatted output", () => {
    const text = "Here is code:\n\n```js\nconst x = 1;\n```";
    const result = formatMessage(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]?.formatted).toBe(true);
  });
});
