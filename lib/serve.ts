import { autoRetry } from "@grammyjs/auto-retry";
import type { Event, FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2";
import { defineCommand } from "citty";
import { Bot, type Context } from "grammy";
import { BOT_COMMANDS, registerCommands } from "~/lib/commands";
import { BotContext } from "~/lib/context";
import { processEvent, stopTyping } from "~/lib/events";
import { handleCallbackQuery, handleCustomTextInput } from "~/lib/handlers";
import { registerMediaHandlers } from "~/lib/media";
import {
	getDirectory,
	initClient,
	initDirectory,
	stopEventListening,
	subscribeToEvents,
} from "~/lib/opencode";
import { promptOpenCode } from "~/lib/prompt";
import { createSandboxedServer } from "~/lib/sandbox";
import { loadSessionID } from "~/lib/session";

function validateEnv(): { token: string; userId: number } {
	const token = process.env.TELEGRAM_BOT_TOKEN;
	if (!token) {
		console.error(
			"Missing TELEGRAM_BOT_TOKEN. Get one from @BotFather on Telegram.",
		);
		process.exit(1);
	}

	const rawUserId = process.env.TELEGRAM_USER_ID;
	if (!rawUserId) {
		console.error(
			"Missing TELEGRAM_USER_ID. Send /start to @userinfobot on Telegram to find your numeric user ID.",
		);
		process.exit(1);
	}

	const userId = Number(rawUserId);
	if (Number.isNaN(userId) || userId <= 0) {
		console.error(
			`Invalid TELEGRAM_USER_ID: "${rawUserId}". Must be a positive integer.`,
		);
		process.exit(1);
	}

	return { token, userId };
}

export default defineCommand({
	meta: { description: "Start the Telegram bot server" },
	run: async () => {
		const { token, userId } = validateEnv();

		console.log("[bot] Starting OpenCode server...");
		const server = await createSandboxedServer({ port: 4096 });
		console.log(`[bot] OpenCode server running at ${server.url}`);

		initClient(server.url);
		await initDirectory();

		const bot = new Bot(token);
		const botCtx = new BotContext();

		// Load persisted session ID
		botCtx.sessionID = loadSessionID();

		// Auto-retry on Telegram 429 flood waits
		bot.api.config.use(autoRetry());

		// Register command menu in Telegram
		await bot.api.setMyCommands(BOT_COMMANDS);

		// SSE event subscription management
		function handleEvent(event: Event) {
			if (botCtx.eventChatId)
				processEvent(event, bot, botCtx.eventChatId, botCtx);
		}

		function ensureSubscription(directory: string, chatId: number) {
			botCtx.eventChatId = chatId;
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
		registerCommands(bot, botCtx, ensureSubscription);

		// Callback queries
		bot.on("callback_query:data", (ctx) => handleCallbackQuery(ctx, botCtx));

		// Prompt helper bound to this bot's context
		const prompt = (
			ctx: Context,
			parts: Array<TextPartInput | FilePartInput>,
		) => promptOpenCode(ctx, parts, botCtx, bot.api, ensureSubscription);

		// Text messages
		bot.on("message:text", async (ctx) => {
			if (await handleCustomTextInput(ctx, botCtx)) return;
			await prompt(ctx, [{ type: "text", text: ctx.message.text }]);
		});

		// Media handlers (photo, video, voice, audio, video_note, sticker, document)
		registerMediaHandlers(bot, token, prompt);

		// Error handler
		bot.catch((err) => console.error("[bot] Error:", err));

		// Graceful shutdown
		const shutdown = () => {
			console.log("[bot] Shutting down...");
			stopTyping(botCtx);
			stopEventListening();
			server.close();
			bot.stop();
		};
		process.on("SIGINT", shutdown);
		process.on("SIGTERM", shutdown);

		console.log("[bot] Starting Telegram bot...");
		await bot.start();
	},
});
