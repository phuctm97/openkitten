import type { Event } from "@opencode-ai/sdk/v2";
import type { Api, Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import type { QuestionState } from "~/lib/state";
import * as state from "~/lib/state";

let typingTimer: ReturnType<typeof setInterval> | null = null;

function startTyping(bot: Bot, chatId: number): void {
	if (typingTimer) return;
	const send = () => bot.api.sendChatAction(chatId, "typing").catch(() => {});
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

function hashString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash = hash & hash;
	}
	return hash.toString(36);
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
	const header = question.header ? `*${progress}${question.header}*\n\n` : "";
	const multi = question.multiple ? "\n_(Select multiple)_" : "";
	const text = `${header}${question.question}${multi}`;

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
	keyboard.text("Custom answer...", `question:custom:${idx}`).row();
	keyboard.text("Cancel", `question:cancel:${idx}`);

	api
		.sendMessage(chatId, text, {
			reply_markup: keyboard,
			parse_mode: "Markdown",
		})
		.then((msg) => {
			qs.messageIds.push(msg.message_id);
			qs.activeMessageId = msg.message_id;
		})
		.catch(console.error);
}

export function processEvent(event: Event, bot: Bot, chatId: number): void {
	const session = state.getSession();
	if (!session) return;

	switch (event.type) {
		case "message.part.updated": {
			const { part } = event.properties;
			if (part.sessionID !== session.id) return;
			if (part.type !== "text" || !("text" in part) || !part.text) return;

			const messageID = part.messageID;
			const hashes = state.getPartHashes();
			let hashSet = hashes.get(messageID);
			if (!hashSet) {
				hashSet = new Set();
				hashes.set(messageID, hashSet);
			}
			const h = hashString(part.text);
			if (hashSet.has(h)) return;
			hashSet.add(h);

			const msgs = state.getMessages();
			const acc = state.getAccumulatedText();

			if (msgs.has(messageID) && msgs.get(messageID)?.role === "assistant") {
				let parts = acc.get(messageID);
				if (!parts) {
					parts = [];
					acc.set(messageID, parts);
					startTyping(bot, chatId);
				}
				parts.push(part.text);
			} else {
				const key = `pending:${messageID}`;
				let pending = acc.get(key);
				if (!pending) {
					pending = [];
					acc.set(key, pending);
				}
				pending.push(part.text);
			}
			break;
		}

		case "message.updated": {
			const { info } = event.properties;
			if (info.sessionID !== session.id) return;

			const messageID = info.id;
			const msgs = state.getMessages();
			msgs.set(messageID, { role: info.role });

			if (info.role === "assistant") {
				const acc = state.getAccumulatedText();
				let msgParts = acc.get(messageID);
				if (!msgParts) {
					msgParts = [];
					acc.set(messageID, msgParts);
					startTyping(bot, chatId);
				}

				// Merge pending parts
				const pendingKey = `pending:${messageID}`;
				const pending = acc.get(pendingKey);
				if (pending) {
					msgParts.push(...pending);
					acc.delete(pendingKey);
				}

				const time = (info as { time?: { completed?: number } }).time;
				if (time?.completed) {
					const parts = acc.get(messageID) ?? [];
					const lastPart = parts[parts.length - 1] ?? "";

					if (lastPart.length > 0) {
						for (const chunk of chunkMessage(lastPart)) {
							bot.api.sendMessage(chatId, chunk).catch(console.error);
						}
					}

					acc.delete(messageID);
					msgs.delete(messageID);
					state.getPartHashes().delete(messageID);

					if (acc.size === 0) stopTyping();
					state.setBusy(false);
				}
			}
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
			if (props.sessionID !== session.id) return;

			const msg =
				props.error?.data?.message ?? props.error?.message ?? "Unknown error";
			stopTyping();
			state.clearAccumulatedText();
			state.setBusy(false);
			bot.api.sendMessage(chatId, `Error: ${msg}`).catch(console.error);
			break;
		}

		case "session.idle": {
			const props = event.properties as { sessionID: string };
			if (props.sessionID !== session.id) return;
			stopTyping();
			state.clearAccumulatedText();
			state.setBusy(false);
			break;
		}

		case "permission.asked": {
			const request = event.properties as {
				id: string;
				sessionID: string;
				permission: string;
				patterns: string[];
			};
			if (request.sessionID !== session.id) return;

			stopTyping();

			const keyboard = new InlineKeyboard()
				.text("Allow Once", "permission:once")
				.row()
				.text("Always Allow", "permission:always")
				.row()
				.text("Deny", "permission:reject");

			let text = `Permission: ${request.permission}\n`;
			if (request.patterns?.length) {
				for (const p of request.patterns) {
					text += `${p}\n`;
				}
			}

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
			if (props.sessionID !== session.id) return;

			stopTyping();

			const qs: state.QuestionState = {
				requestID: props.id,
				questions: props.questions,
				currentIndex: 0,
				answers: [],
				selectedOptions: new Map(),
				customAnswers: new Map(),
				waitingForCustomInput: null,
				messageIds: [],
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
