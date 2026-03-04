/**
 * Pure callback processors — handle permission/question button presses and custom text input.
 * Returns CallbackEffect descriptors. No IO.
 */

import {
	buildQuestionKeyboard,
	formatAnsweredQuestion,
	formatCancelledQuestion,
	formatQuestionMessage,
} from "./keyboard-builder";
import type { CallbackEffect, QuestionState, SessionState } from "./types";

// ── Permission callback ─────────────────────────────────────────────────────

export function processPermissionCallback(
	data: string,
	messageId: number,
	state: SessionState,
	_directory: string,
): CallbackEffect[] {
	const reply = data.split(":")[1];
	if (reply !== "once" && reply !== "always" && reply !== "reject") {
		return [{ type: "answer_callback" }];
	}

	const pending = state.pendingPermissions.get(messageId);
	if (!pending) {
		return [
			{
				type: "answer_callback",
				text: "Permission request expired",
				showAlert: true,
			},
		];
	}

	const ackText =
		{ once: "Allowed once", always: "Always allowed", reject: "Denied" }[
			reply
		] ?? reply;

	return [
		{ type: "answer_callback", text: ackText },
		{ type: "delete_message" },
		{
			type: "reply_permission",
			requestID: pending.requestID,
			reply: reply as "once" | "always" | "reject",
		},
		{ type: "remove_pending_permission", messageId },
	];
}

// ── Question select callback ────────────────────────────────────────────────

export function processQuestionSelect(
	questionIndex: number,
	optionIndex: number,
	state: SessionState,
): CallbackEffect[] {
	const qs = state.questionState;
	if (!qs) {
		return [
			{ type: "answer_callback", text: "No active question", showAlert: true },
		];
	}

	if (questionIndex !== qs.currentIndex) {
		return [
			{ type: "answer_callback", text: "Question expired", showAlert: true },
		];
	}

	const question = qs.questions[questionIndex];
	if (!question) {
		return [{ type: "answer_callback" }];
	}

	let selected = qs.selectedOptions.get(questionIndex);
	if (!selected) {
		selected = new Set();
		qs.selectedOptions.set(questionIndex, selected);
	}

	if (question.multiple) {
		// Toggle selection
		if (selected.has(optionIndex)) selected.delete(optionIndex);
		else selected.add(optionIndex);

		// Rebuild keyboard with updated selection
		const text = formatQuestionMessage(qs);
		const keyboard = buildQuestionKeyboard(question, questionIndex, selected);

		return [
			{ type: "answer_callback" },
			{ type: "edit_message", text, keyboard },
		];
	}

	// Single-select: pick option and advance
	selected.clear();
	selected.add(optionIndex);

	const answer = question.options[optionIndex]?.label ?? "";
	const text = formatAnsweredQuestion(qs, questionIndex, answer);

	return [
		{ type: "answer_callback" },
		{ type: "edit_message", text },
		{ type: "advance_question", questionState: qs, questionIndex },
	];
}

// ── Question submit callback (multi-select) ─────────────────────────────────

export function processQuestionSubmit(
	questionIndex: number,
	state: SessionState,
): CallbackEffect[] {
	const qs = state.questionState;
	if (!qs) {
		return [
			{ type: "answer_callback", text: "No active question", showAlert: true },
		];
	}

	if (questionIndex !== qs.currentIndex) {
		return [
			{ type: "answer_callback", text: "Question expired", showAlert: true },
		];
	}

	const selected = qs.selectedOptions.get(questionIndex);
	if (!selected || selected.size === 0) {
		return [
			{
				type: "answer_callback",
				text: "Select at least one option",
				showAlert: true,
			},
		];
	}

	const question = qs.questions[questionIndex];
	const labels = question
		? Array.from(selected)
				.map((i) => question.options[i]?.label ?? "")
				.filter(Boolean)
				.join(", ")
		: "";

	const text = formatAnsweredQuestion(qs, questionIndex, labels);

	return [
		{ type: "answer_callback" },
		{ type: "edit_message", text },
		{ type: "advance_question", questionState: qs, questionIndex },
	];
}

// ── Question cancel callback ────────────────────────────────────────────────

export function processQuestionCancel(
	questionIndex: number,
	state: SessionState,
	_directory: string,
): CallbackEffect[] {
	const qs = state.questionState;
	if (!qs) {
		return [{ type: "answer_callback" }];
	}

	const text = formatCancelledQuestion(qs, questionIndex);
	const emptyAnswers = qs.questions.map(() => [] as string[]);

	return [
		{ type: "edit_message", text },
		{ type: "answer_callback" },
		{
			type: "reply_question",
			requestID: qs.requestID,
			answers: emptyAnswers,
		},
		{ type: "clear_question_state" },
		{ type: "start_typing" },
	];
}

// ── Custom text input (user types answer instead of clicking) ───────────────

export function processCustomTextInput(
	text: string,
	state: SessionState,
): CallbackEffect[] | null {
	const qs = state.questionState;
	if (!qs) return null; // not in question mode

	const qIdx = qs.currentIndex;
	qs.customAnswers.set(qIdx, text);

	const formattedText = formatAnsweredQuestion(qs, qIdx, text);

	const effects: CallbackEffect[] = [];

	if (qs.activeMessageId) {
		effects.push({ type: "edit_message", text: formattedText });
	}

	effects.push({
		type: "advance_question",
		questionState: qs,
		questionIndex: qIdx,
	});

	return effects;
}

// ── Question advancement helper ─────────────────────────────────────────────

/**
 * Compute the effects for advancing to the next question or submitting all answers.
 * Called by the effect executor when it encounters an `advance_question` effect.
 */
export function computeAdvanceEffects(
	qs: QuestionState,
	qIdx: number,
	_directory: string,
): CallbackEffect[] {
	// Record the answer for this question
	const customAnswer = qs.customAnswers.get(qIdx);
	if (customAnswer) {
		qs.answers[qIdx] = [customAnswer];
	} else {
		const selected = qs.selectedOptions.get(qIdx);
		const question = qs.questions[qIdx];
		if (selected && question) {
			qs.answers[qIdx] = Array.from(selected).map(
				(i) => question.options[i]?.label ?? "",
			);
		} else {
			qs.answers[qIdx] = [];
		}
	}

	qs.currentIndex++;

	if (qs.currentIndex < qs.questions.length) {
		// Show next question
		return [{ type: "show_question", questionState: qs }];
	}

	// All questions answered — submit
	// Fill in any unanswered questions
	for (let i = 0; i < qs.questions.length; i++) {
		if (!qs.answers[i]) {
			const custom = qs.customAnswers.get(i);
			if (custom) {
				qs.answers[i] = [custom];
			} else {
				const selected = qs.selectedOptions.get(i);
				const question = qs.questions[i];
				if (selected && question) {
					qs.answers[i] = Array.from(selected).map(
						(j) => question.options[j]?.label ?? "",
					);
				} else {
					qs.answers[i] = [];
				}
			}
		}
	}

	return [
		{
			type: "reply_question",
			requestID: qs.requestID,
			answers: qs.answers,
		},
		{ type: "clear_question_state" },
		{ type: "start_typing" },
	];
}
