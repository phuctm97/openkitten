import { describe, expect, it } from "bun:test";
import { formatNotice } from "~/lib/core/notice-formatter";

describe("formatNotice", () => {
	it("formats started notice with blockquote", () => {
		const text = formatNotice("started", "New session created.");
		expect(text).toContain("> \u{1F7E2}");
		expect(text).toContain("**Started:**");
		expect(text).toContain("New session created.");
	});

	it("formats error notice", () => {
		const text = formatNotice("error", "Something went wrong");
		expect(text).toContain("**Error:**");
		expect(text).toContain("Something went wrong");
	});

	it("includes code block when provided", () => {
		const text = formatNotice("started", "Session created.", {
			language: "ID",
			content: "abc-123",
		});
		expect(text).toContain("```ID\nabc-123\n```");
	});

	it("handles multi-line messages", () => {
		const text = formatNotice("help", "Line 1\nLine 2\nLine 3");
		const lines = text.split("\n");
		// All lines should be blockquoted
		for (const line of lines) {
			expect(line.startsWith(">")).toBe(true);
		}
	});

	it("formats all notice kinds", () => {
		const kinds = ["started", "stopped", "busy", "error", "help"] as const;
		for (const kind of kinds) {
			const text = formatNotice(kind, "test");
			expect(text.length).toBeGreaterThan(0);
			expect(text).toContain(">");
		}
	});
});
