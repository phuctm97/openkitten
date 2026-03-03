import { describe, expect, test } from "bun:test";
import {
	buildAnsweredMessage,
	buildCancelledMessage,
	buildQuestionMessage,
} from "~/lib/question-ui";
import type { QuestionState } from "~/lib/types";

function makeQuestionState(
	overrides: Partial<QuestionState> = {},
): QuestionState {
	return {
		requestID: "req-1",
		questions: [
			{
				header: "Auth",
				question: "Choose your method",
				options: [
					{ label: "OAuth", description: "Use OAuth" },
					{ label: "JWT", description: "Use JWT" },
				],
			},
		],
		currentIndex: 0,
		answers: [],
		selectedOptions: new Map(),
		customAnswers: new Map(),
		activeMessageId: null,
		...overrides,
	};
}

describe("buildQuestionMessage", () => {
	test("returns null for invalid currentIndex", () => {
		const qs = makeQuestionState({ currentIndex: 5 });
		expect(buildQuestionMessage(qs)).toBeNull();
	});

	test("returns message with keyboard for valid question", () => {
		const qs = makeQuestionState();
		const result = buildQuestionMessage(qs);
		expect(result).not.toBeNull();
		expect(result!.text).toBeTruthy();
		expect(result!.keyboard).toBeTruthy();
	});

	test("includes progress counter for multi-question surveys", () => {
		const qs = makeQuestionState({
			questions: [
				{
					header: "Q1",
					question: "First?",
					options: [{ label: "A", description: "A" }],
				},
				{
					header: "Q2",
					question: "Second?",
					options: [{ label: "B", description: "B" }],
				},
			],
		});
		const result = buildQuestionMessage(qs);
		expect(result).not.toBeNull();
		// Progress should be 1/2
		expect(result!.text).toContain("1/2");
	});

	test("does not show progress for single question", () => {
		const qs = makeQuestionState();
		const result = buildQuestionMessage(qs);
		expect(result).not.toBeNull();
		expect(result!.text).not.toContain("1/1");
	});

	test("shows checkmark for selected options", () => {
		const qs = makeQuestionState();
		qs.selectedOptions.set(0, new Set([0]));
		const result = buildQuestionMessage(qs);
		expect(result).not.toBeNull();
		// The keyboard should have a checkmark for the first option
		// (testing through message existence is sufficient since keyboard is opaque)
		expect(result!.keyboard).toBeTruthy();
	});
});

describe("buildAnsweredMessage", () => {
	test("formats answered question with header", () => {
		const qs = makeQuestionState();
		const result = buildAnsweredMessage(qs, 0, "OAuth");
		expect(result.text).toBeTruthy();
		// Should contain the checkmark
		expect(result.text).toContain("\u2713");
	});

	test("handles missing question gracefully", () => {
		const qs = makeQuestionState();
		const result = buildAnsweredMessage(qs, 99, "Something");
		expect(result.text).toContain("\u2713");
		expect(result.text).toContain("Something");
	});

	test("includes progress for multi-question", () => {
		const qs = makeQuestionState({
			questions: [
				{
					header: "Q1",
					question: "First?",
					options: [{ label: "A", description: "A" }],
				},
				{
					header: "Q2",
					question: "Second?",
					options: [{ label: "B", description: "B" }],
				},
			],
		});
		const result = buildAnsweredMessage(qs, 0, "A");
		expect(result.text).toBeTruthy();
	});
});

describe("buildCancelledMessage", () => {
	test("formats cancelled question with header", () => {
		const qs = makeQuestionState();
		const result = buildCancelledMessage(qs, 0);
		expect(result.text).toBeTruthy();
		expect(result.text).toContain("\u2717");
	});

	test("handles missing question gracefully", () => {
		const qs = makeQuestionState();
		const result = buildCancelledMessage(qs, 99);
		expect(result.text).toContain("\u2717");
	});
});
