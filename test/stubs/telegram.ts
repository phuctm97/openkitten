import type {
	InlineKeyboardData,
	SentMessage,
	TelegramPort,
} from "~/lib/ports/telegram";

export interface TelegramCall {
	method: string;
	args: unknown[];
}

export function createTelegramStub(): TelegramPort & {
	calls: TelegramCall[];
	nextMessageId: number;
	failNextSend: boolean;
} {
	let nextMessageId = 1;
	const calls: TelegramCall[] = [];
	let failNextSend = false;

	return {
		calls,
		get nextMessageId() {
			return nextMessageId;
		},
		set nextMessageId(v: number) {
			nextMessageId = v;
		},
		get failNextSend() {
			return failNextSend;
		},
		set failNextSend(v: boolean) {
			failNextSend = v;
		},

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
			calls.push({ method: "sendMessage", args: [chatId, text, options] });
			if (failNextSend) {
				failNextSend = false;
				throw new Error("Stubbed send failure");
			}
			const id = nextMessageId++;
			return { message_id: id, chat: { id: chatId } };
		},

		async editMessageText(
			chatId: number,
			messageId: number,
			text: string,
			options?: {
				parse_mode?: "MarkdownV2";
				reply_markup?: InlineKeyboardData;
			},
		): Promise<void> {
			calls.push({
				method: "editMessageText",
				args: [chatId, messageId, text, options],
			});
		},

		async deleteMessage(chatId: number, messageId: number): Promise<void> {
			calls.push({ method: "deleteMessage", args: [chatId, messageId] });
		},

		async answerCallbackQuery(
			callbackQueryId: string,
			options?: { text?: string; show_alert?: boolean },
		): Promise<void> {
			calls.push({
				method: "answerCallbackQuery",
				args: [callbackQueryId, options],
			});
		},

		async sendChatAction(chatId: number, action: "typing"): Promise<void> {
			calls.push({ method: "sendChatAction", args: [chatId, action] });
		},

		async getFile(fileId: string): Promise<{ file_path?: string }> {
			calls.push({ method: "getFile", args: [fileId] });
			return { file_path: `files/${fileId}` };
		},

		async downloadFile(url: string): Promise<Buffer | null> {
			calls.push({ method: "downloadFile", args: [url] });
			return Buffer.from("stub-file-content");
		},
	};
}
