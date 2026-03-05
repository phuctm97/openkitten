import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { showQuestion, startTyping } from "~/lib/events";
import { convertWithFallback } from "~/lib/markdown";
import { sendNotice } from "~/lib/notice";
import { getClient, getDirectory } from "~/lib/opencode";
import type { QuestionState } from "~/lib/state";
import * as state from "~/lib/state";

function formatAnsweredQuestion(
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

function formatCancelledQuestion(qs: QuestionState, qIdx: number): string {
	const question = qs.questions[qIdx];
	if (!question) return "\u2717 Cancelled";

	const total = qs.questions.length;
	const progress = total > 1 ? `${qIdx + 1}/${total} ` : "";
	const header = question.header ? `**${progress}${question.header}**\n\n` : "";
	return `${header}${question.question}\n\n\u2717 Cancelled`;
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

	await ctx
		.answerCallbackQuery({
			text:
				{ once: "Allowed once", always: "Always allowed", reject: "Denied" }[
					reply
				] ?? reply,
		})
		.catch(() => {});
	await ctx
		.deleteMessage()
		.catch((err) => console.error("[handlers] deleteMessage error:", err));

	getClient()
		.permission.reply({ requestID: pending.requestID, directory, reply })
		.catch((err: unknown) => {
			console.error("[handlers] permission.reply error:", err);
			if (ctx.chat?.id)
				sendNotice(
					ctx.api,
					ctx.chat.id,
					"error",
					"Failed to send permission reply.",
				);
		});

	state.removePermissionState(messageId);
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
				await ctx.answerCallbackQuery().catch(() => {});
				await updateQuestionMessage(ctx, qs);
			} else {
				selected.clear();
				selected.add(optIdx);
				await ctx.answerCallbackQuery().catch(() => {});
				const answer = question.options[optIdx]?.label ?? "";
				const markdown = formatAnsweredQuestion(qs, qIdx, answer);
				const converted = convertWithFallback(markdown);
				await ctx
					.editMessageText(converted.text, {
						...(converted.parseMode && { parse_mode: converted.parseMode }),
					})
					.catch((err) =>
						console.error(
							"[handlers] editMessageText error (single-select):",
							err,
						),
					);
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
			await ctx.answerCallbackQuery().catch(() => {});
			const question = qs.questions[qIdx];
			const labels = question
				? Array.from(selected)
						.map((i) => question.options[i]?.label ?? "")
						.filter(Boolean)
						.join(", ")
				: "";
			const markdown = formatAnsweredQuestion(qs, qIdx, labels);
			const converted = convertWithFallback(markdown);
			await ctx
				.editMessageText(converted.text, {
					...(converted.parseMode && { parse_mode: converted.parseMode }),
				})
				.catch((err) =>
					console.error(
						"[handlers] editMessageText error (multi-select submit):",
						err,
					),
				);
			advanceQuestion(qs, qIdx, ctx, chatId);
			break;
		}
		case "cancel": {
			const cancelMarkdown = formatCancelledQuestion(qs, qIdx);
			const cancelConverted = convertWithFallback(cancelMarkdown);
			await ctx
				.editMessageText(cancelConverted.text, {
					...(cancelConverted.parseMode && {
						parse_mode: cancelConverted.parseMode,
					}),
				})
				.catch((err) =>
					console.error("[handlers] editMessageText error (cancel):", err),
				);
			await ctx.answerCallbackQuery().catch(() => {});

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
						sendNotice(ctx.api, chatId, "error", "Failed to cancel question.");
				});

			state.clearQuestionState();
			// Resume typing — AI continues after question is resolved
			startTyping(ctx.api, chatId);
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
			sendNotice(ctx.api, chatId, "error", "Failed to submit answers.");
		});
	state.clearQuestionState();
	// Resume typing — AI continues after question is resolved
	startTyping(ctx.api, chatId);
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
	const header = question.header ? `**${progress}${question.header}**\n\n` : "";
	const multi = question.multiple ? "\n_Select multiple_" : "";
	const markdown = `${header}${question.question}${multi}\n\n_Or just type your answer._`;

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

	const converted = convertWithFallback(markdown);
	await ctx
		.editMessageText(converted.text, {
			reply_markup: keyboard,
			...(converted.parseMode && { parse_mode: converted.parseMode }),
		})
		.catch((err) =>
			console.error("[handlers] editMessageText error (toggle):", err),
		);
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
		const markdown = formatAnsweredQuestion(qs, qIdx, text);
		const converted = convertWithFallback(markdown);
		await ctx.api
			.editMessageText(chatId, qs.activeMessageId, converted.text, {
				...(converted.parseMode && { parse_mode: converted.parseMode }),
			})
			.catch((err) =>
				console.error("[handlers] editMessageText error (custom text):", err),
			);
	}

	advanceQuestion(qs, qIdx, ctx, chatId);
	return true;
}
