/** Pure notice message builder. Returns markdown string for the standard formatting pipeline. */

import type { NoticeKind } from "./types";

const NOTICE_META: Record<NoticeKind, { emoji: string; description: string }> =
	{
		started: { emoji: "\u{1F7E2}", description: "Started" },
		stopped: { emoji: "\u{1F6D1}", description: "Stopped" },
		busy: { emoji: "\u23F3", description: "Busy" },
		error: { emoji: "\u26A0\uFE0F", description: "Error" },
		help: { emoji: "\u{1F4D6}", description: "Help" },
	};

export function formatNotice(
	kind: NoticeKind,
	message: string,
	codeBlock?: { language: string; content: string },
): string {
	const { emoji, description } = NOTICE_META[kind];

	// Blockquote format: > {emoji} {description}: {message}
	const lines = message.split("\n");
	const quotedLines = lines
		.map((line, i) => {
			if (i === 0) return `> ${emoji} **${description}:** ${line}`;
			return `> ${line}`;
		})
		.join("\n");

	let text = quotedLines;

	if (codeBlock) {
		text += `\n\`\`\`${codeBlock.language}\n${codeBlock.content}\n\`\`\``;
	}

	return text;
}
