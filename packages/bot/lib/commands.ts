import type { BotCommand } from "@grammyjs/types";
import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { stopTyping } from "~/lib/events";
import { getClient } from "~/lib/opencode";
import * as state from "~/lib/state";

export const BOT_COMMANDS: BotCommand[] = [
	{ command: "start", description: "Connect to a project" },
	{ command: "new", description: "Create a new session" },
	{ command: "sessions", description: "List and switch sessions" },
	{ command: "stop", description: "Abort the current request" },
	{ command: "help", description: "Show help message" },
];

export function registerCommands(
	bot: Bot,
	ensureSubscription: (directory: string, chatId: number) => void,
): void {
	bot.command("start", async (ctx) => {
		const client = getClient();
		const { data: projects, error } = await client.project.list();

		if (error || !projects || projects.length === 0) {
			await ctx.reply(
				"No projects detected. Make sure OpenCode is configured.",
			);
			return;
		}

		const project = projects[0];
		if (!project) return;
		state.setDirectory(project.worktree);
		ensureSubscription(project.worktree, ctx.chat.id);

		const name = project.worktree.split("/").pop() ?? project.worktree;
		await ctx.reply(
			`Project: ${name}\nSend a message to start chatting, or /new to create a session.`,
		);
	});

	bot.command("new", async (ctx) => {
		const directory = state.getDirectory();
		if (!directory) {
			await ctx.reply("No project selected. Use /start first.");
			return;
		}

		const client = getClient();
		const { data: session, error } = await client.session.create({
			directory,
		});

		if (error || !session) {
			await ctx.reply("Failed to create session.");
			return;
		}

		stopTyping();
		state.setBusy(false);
		state.setSession({ id: session.id, title: session.title, directory });
		state.clearAccumulatedText();

		await ctx.reply(`New session: ${session.title}`);
	});

	bot.command("stop", async (ctx) => {
		const session = state.getSession();
		const directory = session?.directory ?? state.getDirectory();
		if (!session || !directory) {
			await ctx.reply("No active session.");
			return;
		}

		const client = getClient();
		await client.session
			.abort({ sessionID: session.id, directory })
			.catch(() => {});
		stopTyping();
		state.setBusy(false);
		state.clearAccumulatedText();
		state.clearQuestionState();

		await ctx.reply("Stopped.");
	});

	bot.command("sessions", async (ctx) => {
		const directory = state.getDirectory();
		if (!directory) {
			await ctx.reply("No project selected. Use /start first.");
			return;
		}

		const client = getClient();
		const { data: sessions, error } = await client.session.list({
			directory,
		});

		if (error || !sessions || sessions.length === 0) {
			await ctx.reply("No sessions found.");
			return;
		}

		const keyboard = new InlineKeyboard();
		for (const s of sessions) {
			const label = s.title || s.id.slice(0, 8);
			keyboard.text(label, `sess:${s.id}`).row();
		}

		await ctx.reply("Sessions:", { reply_markup: keyboard });
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
				"/start - Connect to a project",
				"/new - Create a new session",
				"/sessions - List and switch sessions",
				"/stop - Abort the current request",
				"/help - Show this message",
			].join("\n"),
		);
	});
}
