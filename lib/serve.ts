/**
 * Composition root — thin wiring layer.
 * Spawns OpenCode subprocess, creates adapters, wires grammY handlers to App.
 */

import { resolve } from "node:path";
import { autoRetry } from "@grammyjs/auto-retry";
import { defineCommand } from "citty";
import { Bot } from "grammy";
import type { BotCommand } from "grammy/types";
import { BunFileSystemAdapter } from "~/lib/adapters/filesystem-bun";
import { OpenCodeSdkAdapter } from "~/lib/adapters/opencode-sdk";
import { SqliteStorageAdapter } from "~/lib/adapters/storage-sqlite";
import { TelegramGrammyAdapter } from "~/lib/adapters/telegram-grammy";
import { App } from "~/lib/core/app";
import {
	extractMediaDescriptor,
	TELEGRAM_MAX_FILE_SIZE,
} from "~/lib/core/media-pipeline";
import type { TimerPort } from "~/lib/ports/timer";
import { spawnOpencodeServer } from "~/lib/sandbox";

const BOT_COMMANDS: BotCommand[] = [
	{ command: "start", description: "Start a new session" },
	{ command: "stop", description: "Abort the current request" },
	{ command: "help", description: "Show help message" },
];

const MEDIA_TYPES = [
	"photo",
	"video",
	"voice",
	"audio",
	"video_note",
	"sticker",
	"document",
] as const;

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

		// 1. Spawn OpenCode subprocess (with/without sandbox, dynamic port)
		console.log("[bot] Starting OpenCode server...");
		const server = await spawnOpencodeServer();
		console.log(
			`[bot] OpenCode server running at ${server.url} (sandbox: ${server.sandboxed ? "enabled" : "DISABLED"})`,
		);

		// 2. Create OpenCode client with parsed URL + Basic auth headers
		const password = process.env.OPENCODE_SERVER_PASSWORD;
		const headers: Record<string, string> = {};
		if (password) {
			const username = process.env.OPENCODE_SERVER_USERNAME ?? "opencode";
			headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
		}
		const opencodeAdapter = new OpenCodeSdkAdapter(server.url, headers);

		// 3. Get project directory
		const project = await opencodeAdapter.getProjectInfo();
		const directory = project.worktree;

		// 4. Spawn MCP server subprocess and register with OpenCode
		const mcpProc = Bun.spawn(
			["bun", resolve(import.meta.dirname, "adapters/mcp-server.ts")],
			{
				stdio: ["pipe", "pipe", "pipe"],
				env: {
					...process.env,
					TELEGRAM_BOT_TOKEN: token,
					TELEGRAM_CHAT_ID: String(userId),
				},
			},
		);

		// Register MCP server with OpenCode
		try {
			await opencodeAdapter.registerMcpServer("openkitten", "stdio");
			console.log("[bot] MCP server registered with OpenCode");
		} catch (err) {
			console.warn("[bot] Failed to register MCP server:", err);
		}

		// 5. Create grammy Bot with auto-retry middleware
		const bot = new Bot(token);
		bot.api.config.use(autoRetry());

		// 6. Register command menu
		await bot.api.setMyCommands(BOT_COMMANDS);

		// 7. Create real adapters
		const telegramAdapter = new TelegramGrammyAdapter(bot.api, token);
		const storageAdapter = new SqliteStorageAdapter();
		const fsAdapter = new BunFileSystemAdapter();
		const timerAdapter: TimerPort = {
			setInterval: (cb, ms) => setInterval(cb, ms),
			clearInterval: (handle) =>
				clearInterval(handle as ReturnType<typeof setInterval>),
		};

		// 8. Create App instance
		const app = new App(
			telegramAdapter,
			opencodeAdapter,
			storageAdapter,
			fsAdapter,
			timerAdapter,
			userId,
			directory,
		);

		// 9. Initialize (start event subscription)
		await app.initialize();

		// 10. Single-user auth middleware
		bot.use(async (ctx, next) => {
			if (ctx.from?.id !== userId) return;
			await next();
		});

		// 11. Register commands
		bot.command("start", async () => {
			await app.startCommand();
		});
		bot.command("stop", async () => {
			await app.stopCommand();
		});
		bot.command("help", async () => {
			await app.helpCommand();
		});

		// 12. Callback queries
		bot.on("callback_query:data", async (ctx) => {
			const data = ctx.callbackQuery.data;
			const messageId = ctx.callbackQuery.message?.message_id;
			if (!messageId) {
				await ctx.answerCallbackQuery();
				return;
			}
			await app.handleCallbackQuery(ctx.callbackQuery.id, data, messageId);
		});

		// 13. Text messages
		bot.on("message:text", async (ctx) => {
			await app.handleTextMessage(ctx.message.text);
		});

		// 14. Media messages — single loop for all 7 types
		for (const mediaType of MEDIA_TYPES) {
			bot.on(`message:${mediaType}`, async (ctx) => {
				const descriptor = extractMediaDescriptor(mediaType, ctx.message);
				if (!descriptor) return;

				if (
					descriptor.fileSize &&
					descriptor.fileSize > TELEGRAM_MAX_FILE_SIZE
				) {
					// Use a simple error notice
					await app.handleTextMessage("[Error: File too large (max 20MB)]");
					return;
				}

				await app.handleMediaMessage(descriptor, token);
			});
		}

		// 15. Error handler
		bot.catch((err) => console.error("[bot] Error:", err));

		// 16. Graceful shutdown
		const shutdown = () => {
			console.log("[bot] Shutting down...");
			app.shutdown();
			mcpProc.kill();
			server.kill();
			bot.stop();
		};
		process.on("SIGINT", shutdown);
		process.on("SIGTERM", shutdown);

		// 17. Start bot
		console.log("[bot] Starting Telegram bot...");
		await bot.start();
	},
});
