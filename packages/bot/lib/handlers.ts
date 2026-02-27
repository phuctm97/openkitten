import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { showQuestion, stopTyping } from "~/lib/events";
import { getClient } from "~/lib/opencode";
import type { QuestionState } from "~/lib/state";
import * as state from "~/lib/state";

export async function handleCallbackQuery(ctx: Context): Promise<void> {
	const data = ctx.callbackQuery?.data;
	if (!data) return;

	if (data.startsWith("permission:")) {
		await handlePermission(ctx, data);
	} else if (data.startsWith("question:")) {
		await handleQuestion(ctx, data);
	} else if (data.startsWith("sess:")) {
		await handleSessionSwitch(ctx, data);
	} else {
		await ctx.answerCallbackQuery();
	}
}

async function handlePermission(ctx: Context, data: string): Promise<void> {
	const reply = data.split(":")[1] as "once" | "always" | "reject";
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

	const session = state.getSession();
	const directory = session?.directory ?? state.getDirectory();
	if (!directory) {
		await ctx.answerCallbackQuery();
		return;
	}

	await ctx.answerCallbackQuery({
		text:
			{ once: "Allowed once", always: "Always allowed", reject: "Denied" }[
				reply
			] ?? reply,
	});
	await ctx.deleteMessage().catch(() => {});
	stopTyping();

	// Fire-and-forget
	getClient()
		.permission.reply({ requestID: pending.requestID, directory, reply })
		.catch((err: unknown) =>
			console.error("[handlers] permission.reply error:", err),
		);

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

			if (qs.waitingForCustomInput === qIdx) {
				qs.waitingForCustomInput = null;
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
				await ctx.deleteMessage().catch(() => {});
				advanceQuestion(qs, qIdx, ctx, chatId);
			}
			break;
		}
		case "submit": {
			if (qs.waitingForCustomInput === qIdx) qs.waitingForCustomInput = null;

			const selected = qs.selectedOptions.get(qIdx);
			if (!selected || selected.size === 0) {
				await ctx.answerCallbackQuery({
					text: "Select at least one option",
					show_alert: true,
				});
				return;
			}
			await ctx.answerCallbackQuery();
			await ctx.deleteMessage().catch(() => {});
			advanceQuestion(qs, qIdx, ctx, chatId);
			break;
		}
		case "custom": {
			qs.waitingForCustomInput = qIdx;
			await ctx.answerCallbackQuery({
				text: "Type your answer...",
				show_alert: true,
			});
			break;
		}
		case "cancel": {
			await ctx.editMessageText("Question cancelled.").catch(() => {});
			await ctx.answerCallbackQuery();

			// Send empty answers so OpenCode doesn't hang waiting
			const session = state.getSession();
			const directory = session?.directory ?? state.getDirectory();
			if (directory) {
				const emptyAnswers = qs.questions.map(() => [] as string[]);
				getClient()
					.question.reply({
						requestID: qs.requestID,
						directory,
						answers: emptyAnswers,
					})
					.catch((err: unknown) =>
						console.error("[handlers] question.reply (cancel) error:", err),
					);
			}

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

	const session = state.getSession();
	const directory = session?.directory ?? state.getDirectory();
	if (!directory) {
		state.clearQuestionState();
		return;
	}

	// Fire-and-forget
	getClient()
		.question.reply({
			requestID: qs.requestID,
			directory,
			answers: qs.answers,
		})
		.catch((err: unknown) =>
			console.error("[handlers] question.reply error:", err),
		);

	ctx.api.sendMessage(chatId, "Answers submitted.").catch(() => {});
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
	const header = question.header ? `*${progress}${question.header}*\n\n` : "";
	const multi = question.multiple ? "\n_(Select multiple)_" : "";
	const text = `${header}${question.question}${multi}`;

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
	keyboard.text("Custom answer...", `question:custom:${idx}`).row();
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
	if (!qs || qs.waitingForCustomInput === null) return false;

	const text = ctx.message?.text;
	const chatId = ctx.chat?.id;
	if (!text || !chatId) return false;

	const qIdx = qs.waitingForCustomInput;
	qs.customAnswers.set(qIdx, text);
	qs.waitingForCustomInput = null;

	if (qs.activeMessageId) {
		await ctx.api.deleteMessage(chatId, qs.activeMessageId).catch(() => {});
	}

	advanceQuestion(qs, qIdx, ctx, chatId);
	return true;
}

async function handleSessionSwitch(ctx: Context, data: string): Promise<void> {
	const sessionId = data.slice(5);
	const directory = state.getDirectory();

	if (!directory) {
		await ctx.answerCallbackQuery({
			text: "No project selected",
			show_alert: true,
		});
		return;
	}

	const client = getClient();
	const { data: sessions } = await client.session.list({ directory });
	const found = sessions?.find((s) => s.id === sessionId);

	if (!found) {
		await ctx.answerCallbackQuery({
			text: "Session not found",
			show_alert: true,
		});
		return;
	}

	stopTyping();
	state.clearAccumulatedText();
	state.setBusy(false);
	state.clearQuestionState();
	state.setSession({ id: found.id, title: found.title, directory });

	await ctx.answerCallbackQuery({
		text: `Switched to: ${found.title || found.id.slice(0, 8)}`,
	});
}
