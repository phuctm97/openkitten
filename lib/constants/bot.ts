import type { BotCommand } from "grammy/types";

export const BOT_COMMANDS: BotCommand[] = [
	{ command: "start", description: "Start a new session" },
	{ command: "stop", description: "Abort the current request" },
	{ command: "help", description: "Show help message" },
];

type NoticeKind = "started" | "stopped" | "busy" | "error" | "help";

export const BOT_NOTIFICATIONS: Record<
	NoticeKind,
	{ emoji: string; title: string }
> = {
	started: { emoji: "\u{1F7E2}", title: "Started" },
	stopped: { emoji: "\u{1F6D1}", title: "Stopped" },
	busy: { emoji: "\u23F3", title: "Busy" },
	error: { emoji: "\u26A0\uFE0F", title: "Error" },
	help: { emoji: "\u{1F4D6}", title: "Help" },
};
