import { describe, expect, test } from "bun:test";
import { escapeMarkdownV2 } from "~/lib/notice";

describe("escapeMarkdownV2", () => {
	test("escapes underscore", () => {
		expect(escapeMarkdownV2("hello_world")).toBe("hello\\_world");
	});

	test("escapes asterisk", () => {
		expect(escapeMarkdownV2("*bold*")).toBe("\\*bold\\*");
	});

	test("escapes square brackets", () => {
		expect(escapeMarkdownV2("[link]")).toBe("\\[link\\]");
	});

	test("escapes parentheses", () => {
		expect(escapeMarkdownV2("(url)")).toBe("\\(url\\)");
	});

	test("escapes tilde", () => {
		expect(escapeMarkdownV2("~strikethrough~")).toBe("\\~strikethrough\\~");
	});

	test("escapes backtick", () => {
		expect(escapeMarkdownV2("`code`")).toBe("\\`code\\`");
	});

	test("escapes greater than", () => {
		expect(escapeMarkdownV2(">quote")).toBe("\\>quote");
	});

	test("escapes hash", () => {
		expect(escapeMarkdownV2("#heading")).toBe("\\#heading");
	});

	test("escapes plus", () => {
		expect(escapeMarkdownV2("+item")).toBe("\\+item");
	});

	test("escapes hyphen", () => {
		expect(escapeMarkdownV2("a-b")).toBe("a\\-b");
	});

	test("escapes equals", () => {
		expect(escapeMarkdownV2("a=b")).toBe("a\\=b");
	});

	test("escapes pipe", () => {
		expect(escapeMarkdownV2("a|b")).toBe("a\\|b");
	});

	test("escapes curly braces", () => {
		expect(escapeMarkdownV2("{a}")).toBe("\\{a\\}");
	});

	test("escapes dot", () => {
		expect(escapeMarkdownV2("1.")).toBe("1\\.");
	});

	test("escapes exclamation mark", () => {
		expect(escapeMarkdownV2("Hello!")).toBe("Hello\\!");
	});

	test("escapes backslash", () => {
		expect(escapeMarkdownV2("a\\b")).toBe("a\\\\b");
	});

	test("escapes multiple special characters in sequence", () => {
		expect(escapeMarkdownV2("**bold** and _italic_")).toBe(
			"\\*\\*bold\\*\\* and \\_italic\\_",
		);
	});

	test("leaves plain text unchanged", () => {
		expect(escapeMarkdownV2("hello world")).toBe("hello world");
	});

	test("handles empty string", () => {
		expect(escapeMarkdownV2("")).toBe("");
	});

	test("handles all special chars at once", () => {
		const input = "_*[]()~`>#+\\-=|{}.!";
		const result = escapeMarkdownV2(input);
		// Every character should be escaped
		for (const char of input) {
			expect(result).toContain(`\\${char}`);
		}
	});
});
