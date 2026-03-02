import type { Api } from "grammy";

type NoticeKind = "started" | "stopped" | "busy" | "error" | "help";

const NOTICE_META: Record<NoticeKind, { emoji: string; title: string }> = {
	started: { emoji: "✅", title: "Started" },
	stopped: { emoji: "🛑", title: "Stopped" },
	busy: { emoji: "⏳", title: "Busy" },
	error: { emoji: "⚠️", title: "Error" },
	help: { emoji: "📖", title: "Help" },
};

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
	const { emoji, title } = NOTICE_META[kind];
	const header = `>${emoji} *${escapeMarkdownV2(title)}*`;
	const body = escapeMarkdownV2(message)
		.split("\n")
		.map((line) => `>${line}`)
		.join("\n");
	let text = `${header}\n${body}`;

	if (codeBlock) {
		// Inside code fences, language and content are literal — only ` and \ need escaping
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
