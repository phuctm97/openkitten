import { InlineKeyboard } from "grammy";
import { convertWithFallback } from "~/lib/markdown";
import type { QuestionState } from "~/lib/types";

export interface QuestionMessage {
	text: string;
	parseMode?: "MarkdownV2";
	keyboard: InlineKeyboard;
}

export interface FormattedMessage {
	text: string;
	parseMode?: "MarkdownV2";
}

export function buildQuestionMessage(
	qs: QuestionState,
): QuestionMessage | null {
	const question = qs.questions[qs.currentIndex];
	if (!question) return null;

	const idx = qs.currentIndex;
	const total = qs.questions.length;
	const progress = total > 1 ? `${idx + 1}/${total} ` : "";
	const header = question.header ? `**${progress}${question.header}**\n\n` : "";
	const multi = question.multiple ? "\n_Select multiple_" : "";
	const markdown = `${header}${question.question}${multi}\n\n_Or just type your answer._`;

	const keyboard = new InlineKeyboard();
	const selected = qs.selectedOptions.get(idx) ?? new Set<number>();

	for (const [i, opt] of question.options.entries()) {
		const icon = selected.has(i) ? "\u2705 " : "";
		const label = `${icon}${opt.label}`.slice(0, 60);
		keyboard.text(label, `question:select:${idx}:${i}`).row();
	}

	if (question.multiple) {
		keyboard.text("Submit", `question:submit:${idx}`).row();
	}
	keyboard.text("Cancel", `question:cancel:${idx}`);

	const converted = convertWithFallback(markdown);
	return {
		text: converted.text,
		parseMode: converted.parseMode,
		keyboard,
	};
}

export function buildAnsweredMessage(
	qs: QuestionState,
	qIdx: number,
	answer: string,
): FormattedMessage {
	const question = qs.questions[qIdx];
	let markdown: string;
	if (!question) {
		markdown = `\u2713 ${answer}`;
	} else {
		const total = qs.questions.length;
		const progress = total > 1 ? `${qIdx + 1}/${total} ` : "";
		const header = question.header
			? `**${progress}${question.header}**\n\n`
			: "";
		markdown = `${header}${question.question}\n\n\u2713 ${answer}`;
	}
	const converted = convertWithFallback(markdown);
	return { text: converted.text, parseMode: converted.parseMode };
}

export function buildCancelledMessage(
	qs: QuestionState,
	qIdx: number,
): FormattedMessage {
	const question = qs.questions[qIdx];
	let markdown: string;
	if (!question) {
		markdown = "\u2717 Cancelled";
	} else {
		const total = qs.questions.length;
		const progress = total > 1 ? `${qIdx + 1}/${total} ` : "";
		const header = question.header
			? `**${progress}${question.header}**\n\n`
			: "";
		markdown = `${header}${question.question}\n\n\u2717 Cancelled`;
	}
	const converted = convertWithFallback(markdown);
	return { text: converted.text, parseMode: converted.parseMode };
}
