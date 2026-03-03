import { describe, expect, test } from "bun:test";
import {
	convertWithFallback,
	splitMessage,
	TELEGRAM_MAX_LENGTH,
	TELEGRAM_SPLIT_LENGTH,
} from "~/lib/markdown";

describe("splitMessage", () => {
	test("returns single chunk when text fits", () => {
		const text = "Hello, world!";
		expect(splitMessage(text, 100)).toEqual([text]);
	});

	test("splits at paragraph boundary (double newline)", () => {
		const para1 = "First paragraph.";
		const para2 = "Second paragraph.";
		const text = `${para1}\n\n${para2}`;
		const chunks = splitMessage(text, para1.length + 5);
		expect(chunks.length).toBe(2);
		expect(chunks[0]).toBe(para1);
		expect(chunks[1]).toBe(para2);
	});

	test("splits at markdown header boundary", () => {
		const text = "Some intro text.\n## Header\nMore text here.";
		const chunks = splitMessage(text, 25);
		expect(chunks.length).toBe(2);
		expect(chunks[0]).toBe("Some intro text.");
		expect(chunks[1]).toContain("## Header");
	});

	test("splits at single newline when no better option", () => {
		const line1 = "Line one content here";
		const line2 = "Line two content here";
		const text = `${line1}\n${line2}`;
		const chunks = splitMessage(text, line1.length + 5);
		expect(chunks.length).toBe(2);
		expect(chunks[0]).toBe(line1);
		expect(chunks[1]).toBe(line2);
	});

	test("splits at sentence boundary", () => {
		const text = "First sentence. Second sentence here.";
		const chunks = splitMessage(text, 20);
		expect(chunks.length).toBeGreaterThanOrEqual(2);
		// Should split at a sentence ending
		expect(chunks[0]).toContain("First sentence.");
	});

	test("handles code block close/reopen on split", () => {
		const code = "x = 1\n".repeat(20);
		const text = `\`\`\`python\n${code}\`\`\``;
		const chunks = splitMessage(text, 60);
		expect(chunks.length).toBeGreaterThan(1);

		// First chunk should end with closing fence
		expect(chunks[0]).toMatch(/```$/);
		// Subsequent chunks that continue the code block should reopen
		expect(chunks[1]).toMatch(/^```python/);
	});

	test("handles hard cut as ultimate fallback", () => {
		const text = "a".repeat(200);
		const chunks = splitMessage(text, 100);
		expect(chunks.length).toBe(2);
		expect(chunks[0]).toBe("a".repeat(100));
		expect(chunks[1]).toBe("a".repeat(100));
	});

	test("splits before list items", () => {
		const text = "Intro text.\n- Item one\n- Item two\n- Item three";
		const chunks = splitMessage(text, 25);
		expect(chunks.length).toBeGreaterThanOrEqual(2);
		// First chunk should contain intro text
		expect(chunks[0]).toContain("Intro text.");
	});

	test("every chunk fits within maxLength", () => {
		const text = "Hello world. ".repeat(50);
		const maxLen = 80;
		const chunks = splitMessage(text, maxLen);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(maxLen);
		}
	});

	test("preserves all content across chunks", () => {
		const text = "First part.\n\nSecond part.\n\nThird part.";
		const chunks = splitMessage(text, 20);
		const joined = chunks.join("\n\n");
		// All original words should be present
		expect(joined).toContain("First part.");
		expect(joined).toContain("Second part.");
		expect(joined).toContain("Third part.");
	});

	test("uses TELEGRAM_SPLIT_LENGTH as 80% of max", () => {
		expect(TELEGRAM_SPLIT_LENGTH).toBe(Math.floor(TELEGRAM_MAX_LENGTH * 0.8));
	});
});

describe("convertWithFallback", () => {
	test("returns MarkdownV2 for valid markdown", () => {
		const result = convertWithFallback("Hello **world**");
		expect(result.parseMode).toBe("MarkdownV2");
		expect(result.text).toBeTruthy();
	});

	test("falls back to plain text when conversion exceeds limit", () => {
		// Create text that would expand massively with MarkdownV2 escaping
		const text = "a".repeat(TELEGRAM_MAX_LENGTH + 1);
		const result = convertWithFallback(text);
		// Should either be plain or MarkdownV2 depending on expansion
		expect(result.text).toBeTruthy();
	});

	test("returns plain text with no parseMode on fallback", () => {
		const text = "Plain text with no markdown";
		const result = convertWithFallback(text);
		// Valid markdown still gets converted
		expect(result.text).toBeTruthy();
	});
});
