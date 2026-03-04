/** Pure keyboard data builders + question/permission formatters. No grammy dependency. */

import type { InlineKeyboardData } from "~/lib/ports/telegram";
import type { QuestionItem, QuestionState } from "./types";

// ── Permission keyboard ─────────────────────────────────────────────────────

export function buildPermissionKeyboard(): InlineKeyboardData {
	return {
		inline_keyboard: [
			[{ text: "Allow Once", callback_data: "permission:once" }],
			[{ text: "Always Allow", callback_data: "permission:always" }],
			[{ text: "Deny", callback_data: "permission:reject" }],
		],
	};
}

export function formatPermissionMessage(
	permission: string,
	patterns: string[],
): string {
	const patternsText =
		patterns.length > 0 ? patterns.map((p) => `\`${p}\``).join("\n") : "";
	return `**Permission:** ${permission}\n${patternsText}`;
}

// ── Question keyboard ───────────────────────────────────────────────────────

export function buildQuestionKeyboard(
	question: QuestionItem,
	questionIndex: number,
	selectedOptions: Set<number>,
): InlineKeyboardData {
	const rows: Array<Array<{ text: string; callback_data: string }>> = [];

	for (const [i, opt] of question.options.entries()) {
		const icon = selectedOptions.has(i) ? "\u2705 " : "";
		const label = `${icon}${opt.label}`.slice(0, 60);
		rows.push([
			{ text: label, callback_data: `question:select:${questionIndex}:${i}` },
		]);
	}

	if (question.multiple) {
		rows.push([
			{ text: "Submit", callback_data: `question:submit:${questionIndex}` },
		]);
	}
	rows.push([
		{ text: "Cancel", callback_data: `question:cancel:${questionIndex}` },
	]);

	return { inline_keyboard: rows };
}

export function formatQuestionMessage(qs: QuestionState): string {
	const question = qs.questions[qs.currentIndex];
	if (!question) return "";

	const idx = qs.currentIndex;
	const total = qs.questions.length;
	const progress = total > 1 ? `${idx + 1}/${total} ` : "";
	const header = question.header ? `**${progress}${question.header}**\n\n` : "";
	const multi = question.multiple ? "\n_Select multiple_" : "";
	return `${header}${question.question}${multi}\n\n_Or just type your answer._`;
}

export function formatAnsweredQuestion(
	qs: QuestionState,
	qIdx: number,
	answer: string,
): string {
	const question = qs.questions[qIdx];
	if (!question) return `\u2713 ${answer}`;

	const total = qs.questions.length;
	const progress = total > 1 ? `${qIdx + 1}/${total} ` : "";
	const header = question.header ? `**${progress}${question.header}**\n\n` : "";
	return `${header}${question.question}\n\n\u2713 ${answer}`;
}

export function formatCancelledQuestion(
	qs: QuestionState,
	qIdx: number,
): string {
	const question = qs.questions[qIdx];
	if (!question) return "\u2717 Cancelled";

	const total = qs.questions.length;
	const progress = total > 1 ? `${qIdx + 1}/${total} ` : "";
	const header = question.header ? `**${progress}${question.header}**\n\n` : "";
	return `${header}${question.question}\n\n\u2717 Cancelled`;
}
