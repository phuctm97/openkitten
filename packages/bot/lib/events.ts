import type { Event } from "@opencode-ai/sdk/v2";
import type { Api, Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { escapeMarkdown } from "~/lib/markdown";
import type { QuestionState } from "~/lib/state";
import * as state from "~/lib/state";

let typingTimer: ReturnType<typeof setInterval> | null = null;

export function startTyping(api: Api, chatId: number): void {
	if (typingTimer) return;
	const send = () => api.sendChatAction(chatId, "typing").catch(() => {});
	send();
	typingTimer = setInterval(send, 4000);
}

export function stopTyping(): void {
	if (typingTimer) {
		clearInterval(typingTimer);
		typingTimer = null;
	}
}

export function chunkMessage(text: string, maxLength = 4096): string[] {
	if (text.length <= maxLength) return [text];
	const chunks: string[] = [];
	for (let i = 0; i < text.length; i += maxLength) {
		chunks.push(text.slice(i, i + maxLength));
	}
	return chunks;
}

export function showQuestion(
	api: Api,
	chatId: number,
	qs: QuestionState,
): void {
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
		const label = `${icon}${opt.label}`.slice(0, 60);
		keyboard.text(label, `question:select:${idx}:${i}`).row();
	}

	if (question.multiple) {
		keyboard.text("Submit", `question:submit:${idx}`).row();
	}
	keyboard.text("Cancel", `question:cancel:${idx}`);

	api
		.sendMessage(chatId, text, {
			reply_markup: keyboard,
			parse_mode: "Markdown",
		})
		.then((msg) => {
			qs.activeMessageId = msg.message_id;
		})
		.catch(console.error);
}

export function processEvent(event: Event, bot: Bot, chatId: number): void {
	const sessionID = state.getSessionID();
	if (!sessionID) return;

	switch (event.type) {
		case "message.part.updated": {
			const { part } = event.properties;
			if (part.sessionID !== sessionID) return;
			if (part.type !== "text" || !("text" in part) || !part.text) return;

			// Each event contains the full current text — overwrite, don't append
			const acc = state.getAccumulatedText();
			acc.set(part.messageID, part.text);
			startTyping(bot.api, chatId);
			break;
		}

		case "message.updated": {
			const { info } = event.properties;
			if (info.sessionID !== sessionID) return;
			if (info.role !== "assistant") break;

			const time =
				"time" in info ? (info.time as { completed?: number }) : null;
			if (!time?.completed) break;

			const messageID = info.id;
			const acc = state.getAccumulatedText();
			const text = acc.get(messageID) ?? "";

			if (text.length > 0) {
				const chunks = chunkMessage(text);
				let chain: Promise<unknown> = Promise.resolve();
				for (const chunk of chunks) {
					chain = chain.then(() => bot.api.sendMessage(chatId, chunk));
				}
				chain.catch(console.error);
			}

			acc.delete(messageID);

			if (acc.size === 0) stopTyping();
			break;
		}

		case "session.error": {
			const props = event.properties as {
				sessionID: string;
				error?: {
					data?: { message?: string };
					message?: string;
					name?: string;
				};
			};
			if (props.sessionID !== sessionID) return;

			const msg =
				props.error?.data?.message ?? props.error?.message ?? "Unknown error";
			stopTyping();
			state.clearAccumulatedText();
			bot.api.sendMessage(chatId, `Error: ${msg}`).catch(console.error);
			break;
		}

		case "session.idle": {
			const props = event.properties as { sessionID: string };
			if (props.sessionID !== sessionID) return;
			stopTyping();
			state.clearAccumulatedText();
			break;
		}

		case "permission.asked": {
			const request = event.properties as {
				id: string;
				sessionID: string;
				permission: string;
				patterns: string[];
			};
			if (request.sessionID !== sessionID) return;

			// Don't stop typing — AI continues after permission is granted

			const keyboard = new InlineKeyboard()
				.text("Allow Once", "permission:once")
				.row()
				.text("Always Allow", "permission:always")
				.row()
				.text("Deny", "permission:reject");

			const patterns = request.patterns?.length
				? request.patterns.map((p) => `\`${p}\``).join("\n")
				: "";
			const text = `Permission: ${request.permission}\n${patterns}`;

			bot.api
				.sendMessage(chatId, text, { reply_markup: keyboard })
				.then((msg) => {
					state.addPendingPermission(msg.message_id, {
						requestID: request.id,
						messageId: msg.message_id,
					});
				})
				.catch(console.error);
			break;
		}

		case "question.asked": {
			const props = event.properties as {
				id: string;
				sessionID: string;
				questions: state.QuestionItem[];
			};
			if (props.sessionID !== sessionID) return;

			stopTyping();

			const qs: state.QuestionState = {
				requestID: props.id,
				questions: props.questions,
				currentIndex: 0,
				answers: [],
				selectedOptions: new Map(),
				customAnswers: new Map(),
				activeMessageId: null,
			};
			state.setQuestionState(qs);
			showQuestion(bot.api, chatId, qs);
			break;
		}

		default:
			break;
	}
}
