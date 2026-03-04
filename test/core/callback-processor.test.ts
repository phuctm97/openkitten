import { describe, expect, it } from "bun:test";
import {
	computeAdvanceEffects,
	processCustomTextInput,
	processPermissionCallback,
	processQuestionCancel,
	processQuestionSelect,
	processQuestionSubmit,
} from "~/lib/core/callback-processor";
import { createSessionState } from "~/lib/core/session-state";
import type { QuestionState } from "~/lib/core/types";

const DIR = "/test/project";

function makeQuestionState(overrides?: Partial<QuestionState>): QuestionState {
	return {
		requestID: "q1",
		questions: [
			{
				header: "Test",
				question: "Choose one",
				options: [
					{ label: "Option A", description: "desc" },
					{ label: "Option B", description: "desc" },
				],
			},
		],
		currentIndex: 0,
		answers: [],
		selectedOptions: new Map(),
		customAnswers: new Map(),
		activeMessageId: 42,
		...overrides,
	};
}

describe("processPermissionCallback", () => {
	it("handles valid permission reply", () => {
		const state = createSessionState();
		state.pendingPermissions.set(10, { requestID: "perm1", messageId: 10 });

		const effects = processPermissionCallback(
			"permission:once",
			10,
			state,
			DIR,
		);

		expect(effects.length).toBe(4);
		expect(effects[0]).toEqual({
			type: "answer_callback",
			text: "Allowed once",
		});
		expect(effects[1]).toEqual({ type: "delete_message" });
		expect(effects[2]).toEqual({
			type: "reply_permission",
			requestID: "perm1",
			reply: "once",
		});
		expect(effects[3]).toEqual({
			type: "remove_pending_permission",
			messageId: 10,
		});
	});

	it("handles expired permission", () => {
		const state = createSessionState();
		const effects = processPermissionCallback(
			"permission:once",
			999,
			state,
			DIR,
		);

		expect(effects.length).toBe(1);
		expect(effects[0]).toEqual({
			type: "answer_callback",
			text: "Permission request expired",
			showAlert: true,
		});
	});

	it("handles invalid reply type", () => {
		const state = createSessionState();
		const effects = processPermissionCallback(
			"permission:invalid",
			10,
			state,
			DIR,
		);
		expect(effects).toEqual([{ type: "answer_callback" }]);
	});
});

describe("processQuestionSelect", () => {
	it("single select: picks option and advances", () => {
		const state = createSessionState();
		state.questionState = makeQuestionState();

		const effects = processQuestionSelect(0, 0, state);
		expect(effects.length).toBe(3);
		expect(effects[0]).toEqual({ type: "answer_callback" });
		expect(effects[1]?.type).toBe("edit_message");
		expect(effects[2]?.type).toBe("advance_question");
	});

	it("multi select: toggles option and rebuilds keyboard", () => {
		const state = createSessionState();
		state.questionState = makeQuestionState({
			questions: [
				{
					header: "Test",
					question: "Choose many",
					options: [
						{ label: "A", description: "d" },
						{ label: "B", description: "d" },
					],
					multiple: true,
				},
			],
		});

		const effects = processQuestionSelect(0, 0, state);
		expect(effects.length).toBe(2);
		expect(effects[0]).toEqual({ type: "answer_callback" });
		expect(effects[1]?.type).toBe("edit_message");

		// Check option was toggled on
		expect(state.questionState?.selectedOptions.get(0)?.has(0)).toBe(true);

		// Toggle again — should remove
		processQuestionSelect(0, 0, state);
		expect(state.questionState?.selectedOptions.get(0)?.has(0)).toBe(false);
	});

	it("returns error for no active question", () => {
		const state = createSessionState();
		const effects = processQuestionSelect(0, 0, state);
		expect(effects[0]).toEqual({
			type: "answer_callback",
			text: "No active question",
			showAlert: true,
		});
	});

	it("returns error for expired question index", () => {
		const state = createSessionState();
		state.questionState = makeQuestionState({ currentIndex: 1 });

		const effects = processQuestionSelect(0, 0, state);
		expect(effects[0]).toEqual({
			type: "answer_callback",
			text: "Question expired",
			showAlert: true,
		});
	});
});

describe("processQuestionSubmit", () => {
	it("submits selected options", () => {
		const state = createSessionState();
		state.questionState = makeQuestionState({
			questions: [
				{
					header: "T",
					question: "Q",
					options: [
						{ label: "A", description: "d" },
						{ label: "B", description: "d" },
					],
					multiple: true,
				},
			],
		});
		state.questionState?.selectedOptions.set(0, new Set([0, 1]));

		const effects = processQuestionSubmit(0, state);
		expect(effects.length).toBe(3);
		expect(effects[0]).toEqual({ type: "answer_callback" });
		expect(effects[1]?.type).toBe("edit_message");
		expect(effects[2]?.type).toBe("advance_question");
	});

	it("rejects empty selection", () => {
		const state = createSessionState();
		state.questionState = makeQuestionState();

		const effects = processQuestionSubmit(0, state);
		expect(effects[0]).toEqual({
			type: "answer_callback",
			text: "Select at least one option",
			showAlert: true,
		});
	});
});

describe("processQuestionCancel", () => {
	it("cancels and sends empty answers", () => {
		const state = createSessionState();
		state.questionState = makeQuestionState();

		const effects = processQuestionCancel(0, state, DIR);
		const types = effects.map((e) => e.type);
		expect(types).toContain("edit_message");
		expect(types).toContain("answer_callback");
		expect(types).toContain("reply_question");
		expect(types).toContain("clear_question_state");
		expect(types).toContain("start_typing");
	});
});

describe("processCustomTextInput", () => {
	it("returns null when no active question", () => {
		const state = createSessionState();
		expect(processCustomTextInput("hello", state)).toBeNull();
	});

	it("stores custom answer and advances", () => {
		const state = createSessionState();
		state.questionState = makeQuestionState();

		const effects = processCustomTextInput("my answer", state);
		expect(effects).not.toBeNull();
		expect(state.questionState?.customAnswers.get(0)).toBe("my answer");

		const types = effects?.map((e) => e.type);
		expect(types).toContain("edit_message");
		expect(types).toContain("advance_question");
	});
});

describe("computeAdvanceEffects", () => {
	it("shows next question when more remain", () => {
		const qs = makeQuestionState({
			questions: [
				{
					header: "Q1",
					question: "First",
					options: [{ label: "A", description: "d" }],
				},
				{
					header: "Q2",
					question: "Second",
					options: [{ label: "B", description: "d" }],
				},
			],
		});
		qs.selectedOptions.set(0, new Set([0]));

		const effects = computeAdvanceEffects(qs, 0, DIR);
		expect(effects.length).toBe(1);
		expect(effects[0]?.type).toBe("show_question");
		expect(qs.currentIndex).toBe(1);
	});

	it("submits all answers when last question", () => {
		const qs = makeQuestionState();
		qs.selectedOptions.set(0, new Set([0]));

		const effects = computeAdvanceEffects(qs, 0, DIR);
		const types = effects.map((e) => e.type);
		expect(types).toContain("reply_question");
		expect(types).toContain("clear_question_state");
		expect(types).toContain("start_typing");
	});
});
