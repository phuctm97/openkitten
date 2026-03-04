/** TelegramPort adapter backed by grammy's Api. */

import type { Api } from "grammy";
import type {
	InlineKeyboardData,
	SentMessage,
	TelegramPort,
} from "~/lib/ports/telegram";

const TELEGRAM_DOWNLOAD_TIMEOUT_MS = 60_000;

export class TelegramGrammyAdapter implements TelegramPort {
	constructor(
		private api: Api,
		private token: string,
	) {}

	async sendMessage(
		chatId: number,
		text: string,
		options?: {
			parse_mode?: "MarkdownV2";
			reply_markup?: InlineKeyboardData;
			disable_notification?: boolean;
			link_preview_options?: { is_disabled: boolean };
		},
	): Promise<SentMessage> {
		const msg = await this.api.sendMessage(chatId, text, options);
		return { message_id: msg.message_id, chat: { id: msg.chat.id } };
	}

	async editMessageText(
		chatId: number,
		messageId: number,
		text: string,
		options?: {
			parse_mode?: "MarkdownV2";
			reply_markup?: InlineKeyboardData;
		},
	): Promise<void> {
		await this.api.editMessageText(chatId, messageId, text, options);
	}

	async deleteMessage(chatId: number, messageId: number): Promise<void> {
		await this.api.deleteMessage(chatId, messageId);
	}

	async answerCallbackQuery(
		callbackQueryId: string,
		options?: { text?: string; show_alert?: boolean },
	): Promise<void> {
		await this.api.answerCallbackQuery(callbackQueryId, options);
	}

	async sendChatAction(chatId: number, action: "typing"): Promise<void> {
		await this.api.sendChatAction(chatId, action);
	}

	async getFile(fileId: string): Promise<{ file_path?: string }> {
		const file = await this.api.getFile(fileId);
		return { file_path: file.file_path };
	}

	async downloadFile(url: string): Promise<Buffer | null> {
		try {
			const res = await fetch(url, {
				signal: AbortSignal.timeout(TELEGRAM_DOWNLOAD_TIMEOUT_MS),
			});
			if (!res.ok) return null;
			return Buffer.from(await res.arrayBuffer());
		} catch {
			return null;
		}
	}

	/** Build download URL for a Telegram file path. */
	buildFileUrl(filePath: string): string {
		return `https://api.telegram.org/file/bot${this.token}/${filePath}`;
	}
}
