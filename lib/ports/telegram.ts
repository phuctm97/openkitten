/** Telegram Bot API boundary — send/edit/delete messages, download files, chat actions, answer callbacks. */

export interface SentMessage {
	message_id: number;
	chat: { id: number };
}

export interface ConvertedText {
	text: string;
	parseMode?: "MarkdownV2";
}

export interface InlineKeyboardData {
	inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

export interface TelegramPort {
	sendMessage(
		chatId: number,
		text: string,
		options?: {
			parse_mode?: "MarkdownV2";
			reply_markup?: InlineKeyboardData;
			disable_notification?: boolean;
			link_preview_options?: { is_disabled: boolean };
		},
	): Promise<SentMessage>;

	editMessageText(
		chatId: number,
		messageId: number,
		text: string,
		options?: {
			parse_mode?: "MarkdownV2";
			reply_markup?: InlineKeyboardData;
		},
	): Promise<void>;

	deleteMessage(chatId: number, messageId: number): Promise<void>;

	answerCallbackQuery(
		callbackQueryId: string,
		options?: { text?: string; show_alert?: boolean },
	): Promise<void>;

	sendChatAction(chatId: number, action: "typing"): Promise<void>;

	getFile(fileId: string): Promise<{ file_path?: string }>;

	downloadFile(url: string): Promise<Buffer | null>;
}
