/**
 * Effect executor — runs Effect/CallbackEffect descriptors against injected ports.
 * This is the ONLY place IO happens in the core flow.
 * Sequential execution, error-resilient (log and continue).
 */

import { convert } from "telegram-markdown-v2";
import type { FileSystemPort } from "~/lib/ports/filesystem";
import type { OpenCodePort } from "~/lib/ports/opencode";
import type { TelegramPort } from "~/lib/ports/telegram";
import type { TimerPort } from "~/lib/ports/timer";
import {
	buildQuestionKeyboard,
	formatQuestionMessage,
} from "./keyboard-builder";
import {
	splitMessage,
	splitOnHorizontalRules,
	TELEGRAM_MAX_LENGTH,
	TELEGRAM_SPLIT_LENGTH,
} from "./message-formatter";
import { formatNotice } from "./notice-formatter";
import { resetSessionState } from "./session-state";
import type { CallbackEffect, Effect, SessionState } from "./types";

export interface EffectDeps {
	telegram: TelegramPort;
	opencode: OpenCodePort;
	timer: TimerPort;
	fs: FileSystemPort;
	chatId: number;
	directory: string;
	state: SessionState;
}

// ── Convert text to MarkdownV2 with fallback ────────────────────────────────

function convertWithFallback(text: string): {
	text: string;
	parseMode?: "MarkdownV2";
} {
	try {
		const formatted = convert(text);
		if (formatted.length <= TELEGRAM_MAX_LENGTH) {
			return { text: formatted, parseMode: "MarkdownV2" };
		}
	} catch {
		// fall through to plain text
	}
	return { text };
}

// ── Send formatted message (NanoClaw pipeline) ─────────────────────────────

async function sendFormattedMessage(
	telegram: TelegramPort,
	chatId: number,
	text: string,
): Promise<void> {
	// Step 1: HR pre-split (Telegram has no HR support)
	const sections = splitOnHorizontalRules(text);

	for (const section of sections) {
		// Step 2: Content-aware splitting
		const chunks = splitMessage(section, TELEGRAM_SPLIT_LENGTH);

		for (const chunk of chunks) {
			try {
				const formatted = convert(chunk);

				if (formatted.length > TELEGRAM_MAX_LENGTH) {
					// Step 3: Escape overflow — re-split proportionally
					const ratio = TELEGRAM_MAX_LENGTH / formatted.length;
					const smallerLimit = Math.floor(chunk.length * ratio * 0.9);
					const subChunks = splitMessage(chunk, smallerLimit);

					for (const sub of subChunks) {
						try {
							const subFormatted = convert(sub);
							if (subFormatted.length <= TELEGRAM_MAX_LENGTH) {
								await telegram.sendMessage(chatId, subFormatted, {
									parse_mode: "MarkdownV2",
									link_preview_options: { is_disabled: true },
								});
							} else {
								// Still too long after re-split — plain text fallback
								await telegram.sendMessage(chatId, sub, {
									link_preview_options: { is_disabled: true },
								});
							}
						} catch {
							await telegram.sendMessage(chatId, sub, {
								link_preview_options: { is_disabled: true },
							});
						}
					}
				} else {
					await telegram.sendMessage(chatId, formatted, {
						parse_mode: "MarkdownV2",
						link_preview_options: { is_disabled: true },
					});
				}
			} catch {
				// Step 4: Conversion failed — plain text fallback
				await telegram.sendMessage(chatId, chunk, {
					link_preview_options: { is_disabled: true },
				});
			}
		}
	}
}

// ── Execute effects (main entry point) ──────────────────────────────────────

export async function executeEffects(
	effects: Effect[],
	deps: EffectDeps,
): Promise<void> {
	for (const effect of effects) {
		try {
			await executeSingleEffect(effect, deps);
		} catch (err) {
			console.error("[executor] Effect failed:", effect.type, err);
			// Continue with remaining effects
		}
	}
}

async function executeSingleEffect(
	effect: Effect,
	deps: EffectDeps,
): Promise<void> {
	const { telegram, timer, state, chatId } = deps;

	switch (effect.type) {
		case "start_typing": {
			if (state.typingHandle) return; // already typing
			const send = () =>
				telegram
					.sendChatAction(chatId, "typing")
					.catch((err) =>
						console.error("[executor] sendChatAction error:", err),
					);
			send();
			state.typingHandle = timer.setInterval(send, 4000);
			break;
		}

		case "stop_typing": {
			if (state.typingHandle) {
				timer.clearInterval(state.typingHandle);
				state.typingHandle = null;
			}
			break;
		}

		case "reset_state": {
			resetSessionState(state);
			break;
		}

		case "send_formatted_message": {
			await sendFormattedMessage(telegram, chatId, effect.text);
			break;
		}

		case "send_message_with_keyboard": {
			const converted = convertWithFallback(effect.text);
			const msg = await telegram.sendMessage(chatId, converted.text, {
				...(converted.parseMode && { parse_mode: converted.parseMode }),
				reply_markup: effect.keyboard,
			});

			// Store the message ID for callback routing
			if (effect.storeAs === "permission" && effect.permissionRequestID) {
				state.pendingPermissions.set(msg.message_id, {
					requestID: effect.permissionRequestID,
					messageId: msg.message_id,
				});
			} else if (effect.storeAs === "question" && state.questionState) {
				state.questionState.activeMessageId = msg.message_id;
			}
			break;
		}

		case "send_notice": {
			const noticeText = formatNotice(
				effect.kind,
				effect.message,
				effect.codeBlock,
			);
			const converted = convertWithFallback(noticeText);
			await telegram.sendMessage(chatId, converted.text, {
				...(converted.parseMode && { parse_mode: converted.parseMode }),
				disable_notification: true,
			});
			break;
		}

		case "delete_message": {
			await telegram.deleteMessage(chatId, effect.messageId);
			break;
		}
	}
}

// ── Execute callback effects ────────────────────────────────────────────────

export async function executeCallbackEffects(
	effects: CallbackEffect[],
	deps: EffectDeps & {
		callbackQueryId: string;
		callbackMessageId: number;
	},
): Promise<void> {
	for (const effect of effects) {
		try {
			await executeSingleCallbackEffect(effect, deps);
		} catch (err) {
			console.error("[executor] Callback effect failed:", effect.type, err);
		}
	}
}

async function executeSingleCallbackEffect(
	effect: CallbackEffect,
	deps: EffectDeps & {
		callbackQueryId: string;
		callbackMessageId: number;
	},
): Promise<void> {
	const { telegram, opencode, timer, state, chatId, directory } = deps;

	switch (effect.type) {
		case "answer_callback": {
			await telegram.answerCallbackQuery(deps.callbackQueryId, {
				text: effect.text,
				show_alert: effect.showAlert,
			});
			break;
		}

		case "edit_message": {
			const converted = convertWithFallback(effect.text);
			await telegram.editMessageText(
				chatId,
				deps.callbackMessageId,
				converted.text,
				{
					...(converted.parseMode && { parse_mode: converted.parseMode }),
					...(effect.keyboard && { reply_markup: effect.keyboard }),
				},
			);
			break;
		}

		case "delete_message": {
			await telegram.deleteMessage(chatId, deps.callbackMessageId);
			break;
		}

		case "reply_permission": {
			await opencode
				.replyPermission(effect.requestID, directory, effect.reply)
				.catch((err) => {
					console.error("[executor] permission.reply error:", err);
				});
			break;
		}

		case "reply_question": {
			await opencode
				.replyQuestion(effect.requestID, directory, effect.answers)
				.catch((err) => {
					console.error("[executor] question.reply error:", err);
				});
			break;
		}

		case "clear_question_state": {
			state.questionState = null;
			break;
		}

		case "remove_pending_permission": {
			state.pendingPermissions.delete(effect.messageId);
			break;
		}

		case "start_typing": {
			if (state.typingHandle) return;
			const send = () =>
				telegram
					.sendChatAction(chatId, "typing")
					.catch((err) =>
						console.error("[executor] sendChatAction error:", err),
					);
			send();
			state.typingHandle = timer.setInterval(send, 4000);
			break;
		}

		case "stop_typing": {
			if (state.typingHandle) {
				timer.clearInterval(state.typingHandle);
				state.typingHandle = null;
			}
			break;
		}

		case "advance_question": {
			const { computeAdvanceEffects } = await import("./callback-processor");
			const advanceEffects = computeAdvanceEffects(
				effect.questionState,
				effect.questionIndex,
				directory,
			);
			await executeCallbackEffects(advanceEffects, deps);
			break;
		}

		case "show_question": {
			const qs = effect.questionState;
			const question = qs.questions[qs.currentIndex];
			if (!question) return;

			const text = formatQuestionMessage(qs);
			const keyboard = buildQuestionKeyboard(
				question,
				qs.currentIndex,
				qs.selectedOptions.get(qs.currentIndex) ?? new Set(),
			);

			const converted = convertWithFallback(text);
			const msg = await telegram.sendMessage(chatId, converted.text, {
				...(converted.parseMode && { parse_mode: converted.parseMode }),
				reply_markup: keyboard,
			});
			qs.activeMessageId = msg.message_id;
			break;
		}
	}
}
