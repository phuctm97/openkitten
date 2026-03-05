import type { Api } from "grammy";
import { BOT_NOTIFICATIONS } from "~/lib/constants/bot";

type NoticeKind = "started" | "stopped" | "busy" | "error" | "help";

function escapeMarkdownV2(text: string): string {
	return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

export function sendNotice(
	api: Api,
	chatId: number,
	kind: NoticeKind,
	message: string,
	codeBlock?: { language: string; content: string },
): void {
	const { emoji, title } = BOT_NOTIFICATIONS[kind];
	const header = `${emoji} *${escapeMarkdownV2(title)}*`;
	const body = escapeMarkdownV2(message)
		.split("\n")
		.map((line) => `>${line}`)
		.join("\n");
	let text = `${header}\n${body}`;

	if (codeBlock) {
		// Inside code fences, only ` and \ need escaping
		const lang = codeBlock.language.replace(/([`\\])/g, "\\$1");
		const code = codeBlock.content.replace(/([`\\])/g, "\\$1");
		text += `\n\`\`\`${lang}\n${code}\n\`\`\``;
	}

	api
		.sendMessage(chatId, text, {
			parse_mode: "MarkdownV2",
			disable_notification: true,
		})
		.catch((err) => console.error("[notice] sendMessage error:", err));
}
