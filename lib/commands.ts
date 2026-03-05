import type { Bot } from "grammy";
import type { BotCommand } from "grammy/types";
import { stopTyping } from "~/lib/events";
import { sendNotice } from "~/lib/notice";
import { getClient, getDirectory } from "~/lib/opencode";
import * as state from "~/lib/state";

export const BOT_COMMANDS: BotCommand[] = [
	{ command: "start", description: "Start a new session" },
	{ command: "stop", description: "Abort the current request" },
	{ command: "help", description: "Show help message" },
];

export function registerCommands(
	bot: Bot,
	ensureSubscription: (directory: string, chatId: number) => void,
): void {
	bot.command("start", async (ctx) => {
		const directory = getDirectory();
		ensureSubscription(directory, ctx.chat.id);

		const client = getClient();
		const { data: session, error } = await client.session.create({
			directory,
		});

		if (error || !session) {
			sendNotice(ctx.api, ctx.chat.id, "error", "Failed to create session.");
			return;
		}

		stopTyping();
		state.setSessionID(session.id);
		state.clearAccumulatedText();
		state.clearQuestionState();
		state.clearPendingPermissions();

		sendNotice(ctx.api, ctx.chat.id, "started", "New session created.", {
			language: "ID",
			content: session.id,
		});
	});

	bot.command("stop", async (ctx) => {
		const sessionID = state.getSessionID();
		if (!sessionID) {
			sendNotice(ctx.api, ctx.chat.id, "error", "No active session.");
			return;
		}

		const directory = getDirectory();
		const client = getClient();
		await client.session.abort({ sessionID, directory }).catch(console.error);
		stopTyping();
		state.clearAccumulatedText();
		state.clearQuestionState();
		state.clearPendingPermissions();

		sendNotice(ctx.api, ctx.chat.id, "stopped", "Current request aborted.");
	});

	bot.command("help", (ctx) => {
		sendNotice(
			ctx.api,
			ctx.chat.id,
			"help",
			[
				"OpenKitten \u2014 AI agent on Telegram",
				"",
				"Send any text message to chat with the AI.",
				"The AI can browse the web, read/write files, and run commands.",
				"",
				"/start \u2014 Start a new session",
				"/stop \u2014 Abort the current request",
				"/help \u2014 Show this message",
			].join("\n"),
		);
	});
}
