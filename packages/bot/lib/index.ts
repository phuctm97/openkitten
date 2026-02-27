import type { Event } from "@opencode-ai/sdk/v2";
import { createOpencodeServer } from "@opencode-ai/sdk/v2/server";
import { Bot } from "grammy";
import { registerCommands } from "~/lib/commands";
import { processEvent, stopTyping } from "~/lib/events";
import { handleCallbackQuery, handleCustomTextInput } from "~/lib/handlers";
import {
	getClient,
	initClient,
	stopEventListening,
	subscribeToEvents,
} from "~/lib/opencode";
import * as state from "~/lib/state";

async function main() {
	const token = process.env.TELEGRAM_BOT_TOKEN;
	const userId = Number(process.env.TELEGRAM_USER_ID);

	if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
	if (!userId || Number.isNaN(userId))
		throw new Error("TELEGRAM_USER_ID is required");

	console.log("[bot] Starting OpenCode server...");
	const server = await createOpencodeServer({ port: 4096 });
	console.log(`[bot] OpenCode server running at ${server.url}`);

	initClient(server.url);

	const bot = new Bot(token);

	// SSE event subscription management
	let eventChatId: number | null = null;

	function handleEvent(event: Event) {
		if (eventChatId) processEvent(event, bot, eventChatId);
	}

	function ensureSubscription(directory: string, chatId: number) {
		eventChatId = chatId;
		subscribeToEvents(directory, handleEvent).catch((err) =>
			console.error("[bot] SSE subscription error:", err),
		);
	}

	// Auth middleware: single-user whitelist
	bot.use(async (ctx, next) => {
		if (ctx.from?.id !== userId) return;
		await next();
	});

	// Register commands
	registerCommands(bot, ensureSubscription);

	// Callback queries
	bot.on("callback_query:data", handleCallbackQuery);

	// Text messages
	bot.on("message:text", async (ctx) => {
		// Check if waiting for custom question input
		if (await handleCustomTextInput(ctx)) return;

		const directory = state.getDirectory();
		if (!directory) {
			await ctx.reply("No project selected. Use /start first.");
			return;
		}

		// Auto-create session if none exists
		let session = state.getSession();
		if (!session) {
			const client = getClient();
			const { data: newSession, error } = await client.session.create({
				directory,
			});
			if (error || !newSession) {
				await ctx.reply("Failed to create session.");
				return;
			}
			session = {
				id: newSession.id,
				title: newSession.title,
				directory,
			};
			state.setSession(session);
		}

		ensureSubscription(directory, ctx.chat.id);

		if (state.isBusy()) {
			await ctx.reply(
				"Still processing the previous message. Use /stop to abort.",
			);
			return;
		}

		state.setBusy(true);

		// Fire-and-forget: do NOT await so grammY can continue polling
		getClient()
			.session.prompt({
				sessionID: session.id,
				directory: session.directory,
				parts: [{ type: "text", text: ctx.message.text }],
			})
			.then(({ error }) => {
				if (error) {
					console.error("[bot] prompt error:", error);
					stopTyping();
					bot.api
						.sendMessage(ctx.chat.id, "Error sending prompt.")
						.catch(() => {});
					state.setBusy(false);
				}
			})
			.catch((err) => {
				console.error("[bot] prompt error:", err);
				stopTyping();
				bot.api
					.sendMessage(ctx.chat.id, "Error sending prompt.")
					.catch(() => {});
				state.setBusy(false);
			});
	});

	// Error handler
	bot.catch((err) => console.error("[bot] Error:", err));

	// Graceful shutdown
	const shutdown = () => {
		console.log("[bot] Shutting down...");
		stopTyping();
		stopEventListening();
		server.close();
		bot.stop();
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	console.log("[bot] Starting Telegram bot...");
	await bot.start();
}

main().catch((err) => {
	console.error("[bot] Fatal error:", err);
	process.exit(1);
});
