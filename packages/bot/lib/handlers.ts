import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { showQuestion } from "~/lib/events";
import { escapeMarkdown } from "~/lib/markdown";
import { getClient, getDirectory } from "~/lib/opencode";
import type { QuestionState } from "~/lib/state";
import * as state from "~/lib/state";

function formatAnsweredQuestion(
	qs: QuestionState,
	qIdx: number,
	answer: string,
): string {
	const question = qs.questions[qIdx];
	if (!question) return `\u2713 ${escapeMarkdown(answer)}`;

	const total = qs.questions.length;
	const progress = total > 1 ? `${qIdx + 1}/${total} ` : "";
	const header = question.header
		? `*${progress}${escapeMarkdown(question.header)}*\n\n`
		: "";
	return `${header}${escapeMarkdown(question.question)}\n\n\u2713 ${escapeMarkdown(answer)}`;
}

function formatCancelledQuestion(qs: QuestionState, qIdx: number): string {
	const question = qs.questions[qIdx];
	if (!question) return "\u2717 Cancelled";

	const total = qs.questions.length;
	const progress = total > 1 ? `${qIdx + 1}/${total} ` : "";
	const header = question.header
		? `*${progress}${escapeMarkdown(question.header)}*\n\n`
		: "";
	return `${header}${escapeMarkdown(question.question)}\n\n\u2717 Cancelled`;
}

export async function handleCallbackQuery(ctx: Context): Promise<void> {
	const data = ctx.callbackQuery?.data;
	if (!data) return;

	if (data.startsWith("permission:")) {
		await handlePermission(ctx, data);
	} else if (data.startsWith("question:")) {
		await handleQuestion(ctx, data);
	} else {
		await ctx.answerCallbackQuery();
	}
}

async function handlePermission(ctx: Context, data: string): Promise<void> {
	const reply = data.split(":")[1];
	if (reply !== "once" && reply !== "always" && reply !== "reject") {
		await ctx.answerCallbackQuery();
		return;
	}
	const messageId = ctx.callbackQuery?.message?.message_id;
	if (!messageId) {
		await ctx.answerCallbackQuery();
		return;
	}

	const pending = state.getPermissionByMessageId(messageId);
	if (!pending) {
		await ctx.answerCallbackQuery({
			text: "Permission request expired",
			show_alert: true,
		});
		return;
	}

	const directory = getDirectory();

	await ctx.answerCallbackQuery({
		text:
			{ once: "Allowed once", always: "Always allowed", reject: "Denied" }[
				reply
			] ?? reply,
	});
	await ctx.deleteMessage().catch(() => {});

	getClient()
		.permission.reply({ requestID: pending.requestID, directory, reply })
		.catch((err: unknown) => {
			console.error("[handlers] permission.reply error:", err);
			if (ctx.chat?.id)
				ctx.api
					.sendMessage(ctx.chat.id, "Failed to send permission reply.")
					.catch(console.error);
		});

	state.removePendingPermission(messageId);
}

async function handleQuestion(ctx: Context, data: string): Promise<void> {
	const qs = state.getQuestionState();
	if (!qs) {
		await ctx.answerCallbackQuery({
			text: "No active question",
			show_alert: true,
		});
		return;
	}

	const parts = data.split(":");
	const action = parts[1];
	const qIdx = Number.parseInt(parts[2] ?? "", 10);

	if (Number.isNaN(qIdx) || qIdx !== qs.currentIndex) {
		await ctx.answerCallbackQuery({
			text: "Question expired",
			show_alert: true,
		});
		return;
	}

	const chatId = ctx.chat?.id;
	if (!chatId) {
		await ctx.answerCallbackQuery();
		return;
	}

	switch (action) {
		case "select": {
			const optIdx = Number.parseInt(parts[3] ?? "", 10);
			if (Number.isNaN(optIdx)) {
				await ctx.answerCallbackQuery();
				break;
			}

			const question = qs.questions[qIdx];
			if (!question) {
				await ctx.answerCallbackQuery();
				break;
			}

			let selected = qs.selectedOptions.get(qIdx);
			if (!selected) {
				selected = new Set();
				qs.selectedOptions.set(qIdx, selected);
			}

			if (question.multiple) {
				if (selected.has(optIdx)) selected.delete(optIdx);
				else selected.add(optIdx);
				await ctx.answerCallbackQuery();
				await updateQuestionMessage(ctx, qs);
			} else {
				selected.clear();
				selected.add(optIdx);
				await ctx.answerCallbackQuery();
				const answer = question.options[optIdx]?.label ?? "";
				const formatted = formatAnsweredQuestion(qs, qIdx, answer);
				await ctx
					.editMessageText(formatted, { parse_mode: "Markdown" })
					.catch(() => {});
				advanceQuestion(qs, qIdx, ctx, chatId);
			}
			break;
		}
		case "submit": {
			const selected = qs.selectedOptions.get(qIdx);
			if (!selected || selected.size === 0) {
				await ctx.answerCallbackQuery({
					text: "Select at least one option",
					show_alert: true,
				});
				return;
			}
			await ctx.answerCallbackQuery();
			const question = qs.questions[qIdx];
			const labels = question
				? Array.from(selected)
						.map((i) => question.options[i]?.label ?? "")
						.filter(Boolean)
						.join(", ")
				: "";
			const formatted = formatAnsweredQuestion(qs, qIdx, labels);
			await ctx
				.editMessageText(formatted, { parse_mode: "Markdown" })
				.catch(() => {});
			advanceQuestion(qs, qIdx, ctx, chatId);
			break;
		}
		case "cancel": {
			const formatted = formatCancelledQuestion(qs, qIdx);
			await ctx
				.editMessageText(formatted, { parse_mode: "Markdown" })
				.catch(() => {});
			await ctx.answerCallbackQuery();

			// Send empty answers so OpenCode doesn't hang waiting
			const emptyAnswers = qs.questions.map(() => [] as string[]);
			getClient()
				.question.reply({
					requestID: qs.requestID,
					directory: getDirectory(),
					answers: emptyAnswers,
				})
				.catch((err: unknown) => {
					console.error("[handlers] question.reply (cancel) error:", err);
					if (chatId)
						ctx.api
							.sendMessage(chatId, "Failed to cancel question.")
							.catch(console.error);
				});

			state.clearQuestionState();
			break;
		}
		default: {
			await ctx.answerCallbackQuery();
			break;
		}
	}
}

function advanceQuestion(
	qs: QuestionState,
	qIdx: number,
	ctx: Context,
	chatId: number,
): void {
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
		showQuestion(ctx.api, chatId, qs);
	} else {
		submitAllAnswers(ctx, chatId);
	}
}

function submitAllAnswers(ctx: Context, chatId: number): void {
	const qs = state.getQuestionState();
	if (!qs) return;

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

	getClient()
		.question.reply({
			requestID: qs.requestID,
			directory: getDirectory(),
			answers: qs.answers,
		})
		.catch((err: unknown) => {
			console.error("[handlers] question.reply error:", err);
			ctx.api
				.sendMessage(chatId, "Failed to submit answers.")
				.catch(console.error);
		});
	state.clearQuestionState();
}

async function updateQuestionMessage(
	ctx: Context,
	qs: QuestionState,
): Promise<void> {
	const question = qs.questions[qs.currentIndex];
	if (!question) return;

	const idx = qs.currentIndex;
	const total = qs.questions.length;
	const progress = total > 1 ? `${idx + 1}/${total} ` : "";
	const header = question.header
		? `*${progress}${escapeMarkdown(question.header)}*\n\n`
		: "";
	const multi = question.multiple ? "\n_(Select multiple)_" : "";
	const text = `${header}${escapeMarkdown(question.question)}${multi}\n\n_Or just type your answer._`;

	const keyboard = new InlineKeyboard();
	const selected = qs.selectedOptions.get(idx) ?? new Set<number>();

	for (const [i, opt] of question.options.entries()) {
		const icon = selected.has(i) ? "\u2705 " : "";
		keyboard
			.text(`${icon}${opt.label}`.slice(0, 60), `question:select:${idx}:${i}`)
			.row();
	}

	if (question.multiple) {
		keyboard.text("Submit", `question:submit:${idx}`).row();
	}
	keyboard.text("Cancel", `question:cancel:${idx}`);

	await ctx
		.editMessageText(text, {
			reply_markup: keyboard,
			parse_mode: "Markdown",
		})
		.catch(() => {});
}

export async function handleCustomTextInput(ctx: Context): Promise<boolean> {
	const qs = state.getQuestionState();
	if (!qs) return false;

	const text = ctx.message?.text;
	const chatId = ctx.chat?.id;
	if (!text || !chatId) return false;

	const qIdx = qs.currentIndex;
	qs.customAnswers.set(qIdx, text);

	if (qs.activeMessageId) {
		const formatted = formatAnsweredQuestion(qs, qIdx, text);
		await ctx.api
			.editMessageText(chatId, qs.activeMessageId, formatted, {
				parse_mode: "Markdown",
			})
			.catch(() => {});
	}

	advanceQuestion(qs, qIdx, ctx, chatId);
	return true;
}
