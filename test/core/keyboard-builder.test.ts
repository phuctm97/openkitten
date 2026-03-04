import { describe, expect, it } from "bun:test";
import {
	buildPermissionKeyboard,
	buildQuestionKeyboard,
	formatAnsweredQuestion,
	formatCancelledQuestion,
	formatPermissionMessage,
	formatQuestionMessage,
} from "~/lib/core/keyboard-builder";
import type { QuestionState } from "~/lib/core/types";

describe("buildPermissionKeyboard", () => {
	it("returns three rows: allow once, always, deny", () => {
		const kb = buildPermissionKeyboard();
		expect(kb.inline_keyboard.length).toBe(3);
		expect(kb.inline_keyboard[0]?.[0]?.text).toBe("Allow Once");
		expect(kb.inline_keyboard[0]?.[0]?.callback_data).toBe("permission:once");
		expect(kb.inline_keyboard[1]?.[0]?.text).toBe("Always Allow");
		expect(kb.inline_keyboard[1]?.[0]?.callback_data).toBe("permission:always");
		expect(kb.inline_keyboard[2]?.[0]?.text).toBe("Deny");
		expect(kb.inline_keyboard[2]?.[0]?.callback_data).toBe("permission:reject");
	});
});

describe("formatPermissionMessage", () => {
	it("formats permission with patterns", () => {
		const msg = formatPermissionMessage("file_read", ["/etc/passwd"]);
		expect(msg).toContain("**Permission:** file_read");
		expect(msg).toContain("`/etc/passwd`");
	});

	it("formats permission without patterns", () => {
		const msg = formatPermissionMessage("shell_exec", []);
		expect(msg).toContain("**Permission:** shell_exec");
	});
});

describe("buildQuestionKeyboard", () => {
	const question = {
		header: "Test",
		question: "Pick one",
		options: [
			{ label: "Option A", description: "desc" },
			{ label: "Option B", description: "desc" },
		],
	};

	it("builds keyboard with options + cancel", () => {
		const kb = buildQuestionKeyboard(question, 0, new Set());
		// 2 options + cancel = 3 rows
		expect(kb.inline_keyboard.length).toBe(3);
		expect(kb.inline_keyboard[0]?.[0]?.callback_data).toBe(
			"question:select:0:0",
		);
		expect(kb.inline_keyboard[2]?.[0]?.text).toBe("Cancel");
	});

	it("shows checkmark for selected options", () => {
		const kb = buildQuestionKeyboard(question, 0, new Set([1]));
		expect(kb.inline_keyboard[0]?.[0]?.text).toBe("Option A");
		expect(kb.inline_keyboard[1]?.[0]?.text).toContain("\u2705");
	});

	it("adds Submit button for multi-select", () => {
		const multiQ = { ...question, multiple: true };
		const kb = buildQuestionKeyboard(multiQ, 0, new Set());
		const texts = kb.inline_keyboard.map((row) => row[0]?.text);
		expect(texts).toContain("Submit");
		expect(texts).toContain("Cancel");
	});
});

describe("formatQuestionMessage", () => {
	it("formats question with progress for multi-question", () => {
		const qs: QuestionState = {
			requestID: "r1",
			questions: [
				{
					header: "Auth",
					question: "Pick method",
					options: [{ label: "OAuth", description: "d" }],
				},
				{
					header: "DB",
					question: "Pick DB",
					options: [{ label: "Postgres", description: "d" }],
				},
			],
			currentIndex: 0,
			answers: [],
			selectedOptions: new Map(),
			customAnswers: new Map(),
			activeMessageId: null,
		};
		const msg = formatQuestionMessage(qs);
		expect(msg).toContain("1/2");
		expect(msg).toContain("**1/2 Auth**");
		expect(msg).toContain("Pick method");
	});

	it("omits progress for single question", () => {
		const qs: QuestionState = {
			requestID: "r1",
			questions: [
				{
					header: "Test",
					question: "Choose",
					options: [],
				},
			],
			currentIndex: 0,
			answers: [],
			selectedOptions: new Map(),
			customAnswers: new Map(),
			activeMessageId: null,
		};
		const msg = formatQuestionMessage(qs);
		expect(msg).not.toContain("/");
		expect(msg).toContain("**Test**");
	});
});

describe("formatAnsweredQuestion", () => {
	it("shows checkmark with answer", () => {
		const qs: QuestionState = {
			requestID: "r1",
			questions: [
				{
					header: "Pick",
					question: "Choose one",
					options: [],
				},
			],
			currentIndex: 0,
			answers: [],
			selectedOptions: new Map(),
			customAnswers: new Map(),
			activeMessageId: null,
		};
		const text = formatAnsweredQuestion(qs, 0, "My answer");
		expect(text).toContain("\u2713 My answer");
		expect(text).toContain("Choose one");
	});
});

describe("formatCancelledQuestion", () => {
	it("shows X mark", () => {
		const qs: QuestionState = {
			requestID: "r1",
			questions: [
				{
					header: "Pick",
					question: "Choose",
					options: [],
				},
			],
			currentIndex: 0,
			answers: [],
			selectedOptions: new Map(),
			customAnswers: new Map(),
			activeMessageId: null,
		};
		const text = formatCancelledQuestion(qs, 0);
		expect(text).toContain("\u2717 Cancelled");
	});
});
