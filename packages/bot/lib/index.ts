import { autoRetry } from "@grammyjs/auto-retry";
import type { Event } from "@opencode-ai/sdk/v2";
import { Bot } from "grammy";
import { BOT_COMMANDS, registerCommands } from "~/lib/commands";
import { processEvent, stopTyping } from "~/lib/events";
import { handleCallbackQuery, handleCustomTextInput } from "~/lib/handlers";
import {
	getClient,
	getDirectory,
	initClient,
	initDirectory,
	stopEventListening,
	subscribeToEvents,
} from "~/lib/opencode";
import { createSandboxedServer } from "~/lib/sandbox";
import * as state from "~/lib/state";

const SESSION_LOCKED_RETRY_DELAY_MS = 1000;
const SESSION_LOCKED_MAX_RETRIES = 3;

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

async function main() {
	const { token, userId } = validateEnv();

	console.log("[bot] Starting OpenCode server...");
	const server = await createSandboxedServer({ port: 4096 });
	console.log(`[bot] OpenCode server running at ${server.url}`);

	initClient(server.url);
	await initDirectory();

	const bot = new Bot(token);

	// Auto-retry on Telegram 429 flood waits
	bot.api.config.use(autoRetry());

	// Register command menu in Telegram
	await bot.api.setMyCommands(BOT_COMMANDS);

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

		const directory = getDirectory();
		ensureSubscription(directory, ctx.chat.id);

		// Auto-create session if none exists
		let sessionID = state.getSessionID();
		if (!sessionID) {
			const client = getClient();
			const { data: newSession, error } = await client.session.create({
				directory,
			});
			if (error || !newSession) {
				await ctx.reply("Failed to create session.");
				return;
			}
			sessionID = newSession.id;
			state.setSessionID(sessionID);
		}

		// Fire-and-forget with SessionLockedError retry
		const prompt = async (retries = 0): Promise<void> => {
			const { error } = await getClient().session.prompt({
				sessionID,
				directory,
				parts: [{ type: "text", text: ctx.message.text }],
			});

			if (error) {
				const errMsg =
					typeof error === "object" && "message" in error
						? (error as { message: string }).message
						: String(error);

				if (errMsg.includes("SessionLocked")) {
					if (retries < SESSION_LOCKED_MAX_RETRIES) {
						console.log(
							`[bot] Session locked, retrying in ${SESSION_LOCKED_RETRY_DELAY_MS}ms (attempt ${retries + 1})`,
						);
						await new Promise((r) =>
							setTimeout(r, SESSION_LOCKED_RETRY_DELAY_MS),
						);
						return prompt(retries + 1);
					}
					bot.api
						.sendMessage(
							ctx.chat.id,
							"Still processing the previous message. Use /stop to abort.",
						)
						.catch((err) =>
							console.error("[bot] sendMessage error (session locked):", err),
						);
					return;
				}

				console.error("[bot] prompt error:", error);
				stopTyping();
				bot.api
					.sendMessage(ctx.chat.id, `Error: ${errMsg}`)
					.catch((err) =>
						console.error("[bot] sendMessage error (error notification):", err),
					);
			}
		};

		prompt().catch((err) => {
			console.error("[bot] prompt error:", err);
			stopTyping();
			bot.api
				.sendMessage(ctx.chat.id, "Error sending prompt.")
				.catch((sendErr) =>
					console.error("[bot] sendMessage error (prompt failure):", sendErr),
				);
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
