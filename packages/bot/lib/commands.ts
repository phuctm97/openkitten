import type { BotCommand } from "@grammyjs/types";
import type { Bot } from "grammy";
import { stopTyping } from "~/lib/events";
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
			await ctx.reply("Failed to create session.");
			return;
		}

		stopTyping();
		state.setSessionID(session.id);
		state.clearAccumulatedText();
		state.clearQuestionState();

		await ctx.reply(`Session started: ${session.title}`);
	});

	bot.command("stop", async (ctx) => {
		const sessionID = state.getSessionID();
		if (!sessionID) {
			await ctx.reply("No active session.");
			return;
		}

		const directory = getDirectory();
		const client = getClient();
		await client.session.abort({ sessionID, directory }).catch(() => {});
		stopTyping();
		state.clearAccumulatedText();
		state.clearQuestionState();

		await ctx.reply("Stopped.");
	});

	bot.command("help", async (ctx) => {
		await ctx.reply(
			[
				"OpenKitten - AI agent on Telegram",
				"",
				"Send any text message to chat with the AI.",
				"The AI can browse the web, read/write files, and run commands.",
				"",
				"Commands:",
				"/start - Start a new session",
				"/stop - Abort the current request",
				"/help - Show this message",
			].join("\n"),
		);
	});
}
