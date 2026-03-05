import type { BotCommand } from "grammy/types";
import type { NoticeType } from "~/lib/types";

export const BOT_HOSTNAME = "127.0.0.1";
export const BOT_SELECTED_ICON = "\u2705 ";
export const BOT_CANCELED_ICON = "\u2717 ";

export const BOT_COMMANDS: BotCommand[] = [
	{ command: "start", description: "Start a new session" },
	{ command: "stop", description: "Abort the current request" },
	{ command: "help", description: "Show help message" },
];

export const BOT_NOTIFICATIONS: Record<
	NoticeType,
	{ emoji: string; title: string }
> = {
	started: { emoji: "\u{1F7E2}", title: "Started" },
	stopped: { emoji: "\u{1F6D1}", title: "Stopped" },
	busy: { emoji: "\u23F3", title: "Busy" },
	error: { emoji: "\u26A0\uFE0F", title: "Error" },
	help: { emoji: "\u{1F4D6}", title: "Help" },
};
