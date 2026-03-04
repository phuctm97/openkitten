import { describe, expect, it } from "bun:test";
import {
	findCodeBlockRanges,
	isInCodeBlock,
	splitMessage,
	splitOnHorizontalRules,
} from "~/lib/core/message-formatter";

describe("splitMessage", () => {
	it("returns single chunk for short text", () => {
		expect(splitMessage("hello", 100)).toEqual(["hello"]);
	});

	it("returns single chunk for text at exactly max length", () => {
		const text = "a".repeat(100);
		expect(splitMessage(text, 100)).toEqual([text]);
	});

	it("returns empty array for empty text (under limit)", () => {
		expect(splitMessage("", 100)).toEqual([""]);
	});

	it("splits at paragraph breaks (\\n\\n)", () => {
		const text = `${"a".repeat(50)}\n\n${"b".repeat(50)}`;
		const chunks = splitMessage(text, 60);
		expect(chunks.length).toBe(2);
		expect(chunks[0]).toBe("a".repeat(50));
		expect(chunks[1]).toBe("b".repeat(50));
	});

	it("splits at single newlines when no paragraph break", () => {
		const text = `${"a".repeat(50)}\n${"b".repeat(50)}`;
		const chunks = splitMessage(text, 60);
		expect(chunks.length).toBe(2);
	});

	it("splits at sentence endings", () => {
		const text = `${"a".repeat(30)}. ${"b".repeat(30)}. ${"c".repeat(30)}`;
		const chunks = splitMessage(text, 50);
		expect(chunks.length).toBeGreaterThan(1);
	});

	it("splits at word boundaries (spaces)", () => {
		const words = Array.from({ length: 20 }, () => "word").join(" ");
		const chunks = splitMessage(words, 30);
		expect(chunks.length).toBeGreaterThan(1);
		// No chunk should start or end with space
		for (const chunk of chunks) {
			expect(chunk).toBe(chunk.trim());
		}
	});

	it("hard cuts when no valid split point", () => {
		const text = "a".repeat(200);
		const chunks = splitMessage(text, 100);
		expect(chunks.length).toBe(2);
		expect(chunks[0]).toBe("a".repeat(100));
		expect(chunks[1]).toBe("a".repeat(100));
	});

	it("prefers headers over paragraph breaks", () => {
		const text = `${"a".repeat(30)}\n\n${"b".repeat(10)}\n## Header\n${"c".repeat(30)}`;
		const chunks = splitMessage(text, 55);
		// Should split before "## Header" rather than at \n\n
		const hasHeaderSplit = chunks.some((c) => c.startsWith("## Header"));
		expect(hasHeaderSplit).toBe(true);
	});

	it("preserves code blocks across splits", () => {
		const codeBlock = `\`\`\`js\n${"// line\n".repeat(20)}\`\`\``;
		const chunks = splitMessage(codeBlock, 80);
		expect(chunks.length).toBeGreaterThan(1);
		// First chunk should end with closing ```
		expect(chunks[0]?.endsWith("```")).toBe(true);
		// Second chunk should start with opening ```js
		expect(chunks[1]?.startsWith("```js\n")).toBe(true);
	});

	it("does not split inside code block when alternatives exist", () => {
		const text = `Some text\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n\nMore text here that is long enough`;
		const chunks = splitMessage(text, 40);
		// Should prefer splitting at \n\n rather than inside code block
		for (const chunk of chunks) {
			const opens = (chunk.match(/```/g) ?? []).length;
			// If a chunk has ``` markers, they should be balanced (0 or 2)
			if (opens > 0) {
				expect(opens % 2).toBe(0);
			}
		}
	});

	it("splits before list items", () => {
		const text = `${"a".repeat(30)}\n- item 1\n- item 2\n- item 3`;
		const chunks = splitMessage(text, 40);
		expect(chunks.length).toBeGreaterThan(1);
	});

	it("splits before horizontal rules", () => {
		const text = `${"a".repeat(30)}\n---\n${"b".repeat(30)}`;
		const chunks = splitMessage(text, 40);
		expect(chunks.length).toBeGreaterThan(1);
	});
});

describe("findCodeBlockRanges", () => {
	it("finds paired code blocks", () => {
		const text = "text\n```js\ncode\n```\nmore";
		const ranges = findCodeBlockRanges(text);
		expect(ranges.length).toBe(1);
		expect(ranges[0]?.lang).toBe("js");
	});

	it("handles unclosed code blocks", () => {
		const text = "text\n```python\ncode here";
		const ranges = findCodeBlockRanges(text);
		expect(ranges.length).toBe(1);
		expect(ranges[0]?.end).toBe(text.length);
	});

	it("finds multiple code blocks", () => {
		const text = "```a\ncode1\n```\n\n```b\ncode2\n```";
		const ranges = findCodeBlockRanges(text);
		expect(ranges.length).toBe(2);
		expect(ranges[0]?.lang).toBe("a");
		expect(ranges[1]?.lang).toBe("b");
	});

	it("returns empty for no code blocks", () => {
		expect(findCodeBlockRanges("just text")).toEqual([]);
	});
});

describe("isInCodeBlock", () => {
	it("returns the block when position is inside", () => {
		const ranges = findCodeBlockRanges("```js\ncode\n```");
		expect(isInCodeBlock(6, ranges)).not.toBeNull();
	});

	it("returns null when position is outside", () => {
		const text = "before\n```js\ncode\n```\nafter";
		const ranges = findCodeBlockRanges(text);
		expect(isInCodeBlock(2, ranges)).toBeNull();
		expect(isInCodeBlock(text.length - 1, ranges)).toBeNull();
	});
});

describe("splitOnHorizontalRules", () => {
	it("splits on ---", () => {
		const sections = splitOnHorizontalRules("first\n---\nsecond");
		expect(sections).toEqual(["first", "second"]);
	});

	it("splits on ___", () => {
		const sections = splitOnHorizontalRules("first\n___\nsecond");
		expect(sections).toEqual(["first", "second"]);
	});

	it("splits on ***", () => {
		const sections = splitOnHorizontalRules("first\n***\nsecond");
		expect(sections).toEqual(["first", "second"]);
	});

	it("returns single section for no HRs", () => {
		const sections = splitOnHorizontalRules("just text");
		expect(sections).toEqual(["just text"]);
	});

	it("filters empty sections", () => {
		const sections = splitOnHorizontalRules("---\ntext\n---");
		expect(sections).toEqual(["text"]);
	});
});
