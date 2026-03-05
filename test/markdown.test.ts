import { describe, expect, it } from "vitest";
import { convertWithFallback, splitMessage } from "~/lib/markdown";

describe("splitMessage", () => {
	it("returns text as-is when under maxLength", () => {
		const text = "Hello, world!";
		expect(splitMessage(text, 100)).toEqual([text]);
	});

	it("splits at paragraph break (double newline)", () => {
		const text = "First paragraph.\n\nSecond paragraph.";
		const chunks = splitMessage(text, 20);
		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks.join("")).toContain("First paragraph.");
		expect(chunks.join("")).toContain("Second paragraph.");
	});

	it("splits at markdown header boundary", () => {
		const text = "Some intro text here.\n## Section Two\nMore content here.";
		const chunks = splitMessage(text, 30);
		expect(chunks[0]).not.toContain("## Section Two");
	});

	it("splits at single newline when no better break exists", () => {
		const lines = Array.from({ length: 10 }, (_, i) => `Line ${i}`).join("\n");
		const chunks = splitMessage(lines, 30);
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(30);
		}
	});

	it("splits at word boundary as last resort", () => {
		const text = "word ".repeat(20).trim();
		const chunks = splitMessage(text, 22);
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(22);
		}
	});

	it("hard-cuts when no split point is found", () => {
		const text = "a".repeat(50);
		const chunks = splitMessage(text, 20);
		expect(chunks.length).toBe(3);
		expect(chunks[0]).toBe("a".repeat(20));
		expect(chunks[1]).toBe("a".repeat(20));
		expect(chunks[2]).toBe("a".repeat(10));
	});

	it("closes and reopens code blocks when splitting inside them", () => {
		const code = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
		const text = `\`\`\`ts\n${code}\n\`\`\``;
		const chunks = splitMessage(text, 60);
		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks[0]?.endsWith("```")).toBe(true);
		expect(chunks[1]?.startsWith("```ts\n")).toBe(true);
	});

	it("preserves all content across chunks", () => {
		const text =
			"First paragraph.\n\nSecond paragraph.\n\n## Header\n\nThird paragraph with more content.";
		const chunks = splitMessage(text, 30);
		const reassembled = chunks.join(" ");
		for (const word of ["First", "Second", "Header", "Third"]) {
			expect(reassembled).toContain(word);
		}
	});
});

describe("convertWithFallback", () => {
	it("returns MarkdownV2 parse mode on success", () => {
		const result = convertWithFallback("Hello **bold** world");
		expect(result.parseMode).toBe("MarkdownV2");
		expect(result.text).toBeTruthy();
	});

	it("falls back to plain text when converted text exceeds max length", () => {
		const long = "Hello *world*! ".repeat(400);
		const result = convertWithFallback(long);
		expect(result.text).toBe(long);
		expect(result.parseMode).toBeUndefined();
	});
});
