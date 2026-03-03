import type { Context } from "grammy";
import type { BotContext } from "~/lib/context";
import { showQuestion, startTyping } from "~/lib/events";
import { sendNotice } from "~/lib/notice";
import { getClient, getDirectory } from "~/lib/opencode";
import {
	buildAnsweredMessage,
	buildCancelledMessage,
	buildQuestionMessage,
} from "~/lib/question-ui";
import type { QuestionState } from "~/lib/types";

export async function handleCallbackQuery(
	ctx: Context,
	botCtx: BotContext,
): Promise<void> {
	const data = ctx.callbackQuery?.data;
	if (!data) return;

	if (data.startsWith("permission:")) {
		await handlePermission(ctx, data, botCtx);
	} else if (data.startsWith("question:")) {
		await handleQuestion(ctx, data, botCtx);
	} else {
		await ctx.answerCallbackQuery();
	}
}

async function handlePermission(
	ctx: Context,
	data: string,
	botCtx: BotContext,
): Promise<void> {
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

	const pending = botCtx.pendingPermissions.get(messageId);
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

	botCtx.pendingPermissions.delete(messageId);
}

async function handleQuestion(
	ctx: Context,
	data: string,
	botCtx: BotContext,
): Promise<void> {
	const qs = botCtx.questionState;
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
				const msg = buildAnsweredMessage(qs, qIdx, answer);
				await ctx
					.editMessageText(msg.text, {
						...(msg.parseMode && { parse_mode: msg.parseMode }),
					})
					.catch((err) =>
						console.error(
							"[handlers] editMessageText error (single-select):",
							err,
						),
					);
				advanceQuestion(qs, qIdx, ctx, chatId, botCtx);
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
			const msg = buildAnsweredMessage(qs, qIdx, labels);
			await ctx
				.editMessageText(msg.text, {
					...(msg.parseMode && { parse_mode: msg.parseMode }),
				})
				.catch((err) =>
					console.error(
						"[handlers] editMessageText error (multi-select submit):",
						err,
					),
				);
			advanceQuestion(qs, qIdx, ctx, chatId, botCtx);
			break;
		}
		case "cancel": {
			const cancelMsg = buildCancelledMessage(qs, qIdx);
			await ctx
				.editMessageText(cancelMsg.text, {
					...(cancelMsg.parseMode && {
						parse_mode: cancelMsg.parseMode,
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

			botCtx.questionState = null;
			// Resume typing — AI continues after question is resolved
			startTyping(botCtx, ctx.api, chatId);
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
	botCtx: BotContext,
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
		submitAllAnswers(ctx, chatId, botCtx);
	}
}

function submitAllAnswers(
	ctx: Context,
	chatId: number,
	botCtx: BotContext,
): void {
	const qs = botCtx.questionState;
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
	botCtx.questionState = null;
	// Resume typing — AI continues after question is resolved
	startTyping(botCtx, ctx.api, chatId);
}

async function updateQuestionMessage(
	ctx: Context,
	qs: QuestionState,
): Promise<void> {
	const msg = buildQuestionMessage(qs);
	if (!msg) return;

	await ctx
		.editMessageText(msg.text, {
			reply_markup: msg.keyboard,
			...(msg.parseMode && { parse_mode: msg.parseMode }),
		})
		.catch((err) =>
			console.error("[handlers] editMessageText error (toggle):", err),
		);
}

export async function handleCustomTextInput(
	ctx: Context,
	botCtx: BotContext,
): Promise<boolean> {
	const qs = botCtx.questionState;
	if (!qs) return false;

	const text = ctx.message?.text;
	const chatId = ctx.chat?.id;
	if (!text || !chatId) return false;

	const qIdx = qs.currentIndex;
	qs.customAnswers.set(qIdx, text);

	if (qs.activeMessageId) {
		const msg = buildAnsweredMessage(qs, qIdx, text);
		await ctx.api
			.editMessageText(chatId, qs.activeMessageId, msg.text, {
				...(msg.parseMode && { parse_mode: msg.parseMode }),
			})
			.catch((err) =>
				console.error("[handlers] editMessageText error (custom text):", err),
			);
	}

	advanceQuestion(qs, qIdx, ctx, chatId, botCtx);
	return true;
}
