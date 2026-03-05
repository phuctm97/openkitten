import { autoRetry } from "@grammyjs/auto-retry";
import type { Event, FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2";
import { defineCommand } from "citty";
import { Bot, type Context } from "grammy";
import { BOT_COMMANDS, registerCommands } from "~/lib/commands";
import { MCP_SERVER_NAME } from "~/lib/constants/mcp";
import {
	OPENCODE_SESSION_LOCKED_MAX_RETRIES,
	OPENCODE_SESSION_LOCKED_RETRY_DELAY_MS,
} from "~/lib/constants/opencode";
import {
	TELEGRAM_FILE_TOO_LARGE_MESSAGE,
	TELEGRAM_MAX_FILE_SIZE,
} from "~/lib/constants/telegram";
import { processEvent, stopTyping } from "~/lib/events";
import {
	buildFileParts,
	downloadTelegramFile,
	resolveFilename,
	saveTempFile,
} from "~/lib/files";
import { handleCallbackQuery, handleCustomTextInput } from "~/lib/handlers";
import { setTelegramContext, startMcpServer } from "~/lib/mcp";
import { sendNotice } from "~/lib/notice";
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

		console.log("[bot] Starting MCP server...");
		const mcpServer = await startMcpServer();
		console.log(`[bot] MCP server running at ${mcpServer.url}`);

		console.log("[bot] Starting OpenCode server...");
		const server = await createSandboxedServer();
		console.log(
			`[bot] OpenCode server running at ${server.url} (sandbox: ${server.sandboxed ? "enabled" : "DISABLED"})`,
		);

		initClient(server.url);
		await initDirectory();

		const mcpName = MCP_SERVER_NAME;
		const client = getClient();
		const { error: mcpAddError } = await client.mcp.add({
			name: mcpName,
			directory: getDirectory(),
			config: {
				type: "remote",
				url: mcpServer.url,
			},
		});
		if (mcpAddError) {
			console.error("[bot] Failed to add MCP server:", mcpAddError);
		}
		const { error: mcpConnectError } = await client.mcp.connect({
			name: mcpName,
			directory: getDirectory(),
		});
		if (mcpConnectError) {
			console.error("[bot] Failed to connect MCP server:", mcpConnectError);
		} else {
			console.log("[bot] MCP server registered and connected");
		}

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
			setTelegramContext(bot.api, chatId);
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

		// Shared prompt helper: session creation + retry logic
		async function promptOpenCode(
			ctx: Context,
			parts: Array<TextPartInput | FilePartInput>,
		): Promise<void> {
			if (!ctx.chat) return;
			const chatId = ctx.chat.id;
			const directory = getDirectory();
			ensureSubscription(directory, chatId);

			// Auto-create session if none exists
			let sessionID = state.getSessionID();
			if (!sessionID) {
				const client = getClient();
				const { data: newSession, error } = await client.session.create({
					directory,
				});
				if (error || !newSession) {
					sendNotice(ctx.api, chatId, "error", "Failed to create session.");
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
					parts,
				});

				if (error) {
					const errMsg =
						typeof error === "object" && "message" in error
							? (error as { message: string }).message
							: String(error);

					if (errMsg.includes("SessionLocked")) {
						if (retries < OPENCODE_SESSION_LOCKED_MAX_RETRIES) {
							console.log(
								`[bot] Session locked, retrying in ${OPENCODE_SESSION_LOCKED_RETRY_DELAY_MS}ms (attempt ${retries + 1})`,
							);
							await new Promise((r) =>
								setTimeout(r, OPENCODE_SESSION_LOCKED_RETRY_DELAY_MS),
							);
							return prompt(retries + 1);
						}
						sendNotice(
							bot.api,
							chatId,
							"busy",
							"Still processing the previous message. Use /stop to abort.",
						);
						return;
					}

					console.error("[bot] prompt error:", error);
					stopTyping();
					sendNotice(bot.api, chatId, "error", errMsg);
				}
			};

			prompt().catch((err) => {
				console.error("[bot] prompt error:", err);
				stopTyping();
				sendNotice(bot.api, chatId, "error", "Error sending prompt.");
			});
		}

		// Text messages
		bot.on("message:text", async (ctx) => {
			// Check if waiting for custom question input
			if (await handleCustomTextInput(ctx)) return;
			await promptOpenCode(ctx, [{ type: "text", text: ctx.message.text }]);
		});

		// Photo messages
		bot.on("message:photo", async (ctx) => {
			const photo = ctx.message.photo.at(-1);
			if (!photo) return;
			if (photo.file_size && photo.file_size > TELEGRAM_MAX_FILE_SIZE) {
				sendNotice(
					ctx.api,
					ctx.chat.id,
					"error",
					TELEGRAM_FILE_TOO_LARGE_MESSAGE,
				);
				return;
			}
			const buffer = await downloadTelegramFile(token, photo.file_id, bot.api);
			if (!buffer) {
				sendNotice(ctx.api, ctx.chat.id, "error", "Failed to download photo.");
				return;
			}
			const filename = resolveFilename("image/jpeg");
			const filePath = await saveTempFile(buffer, filename);
			const parts: Array<TextPartInput | FilePartInput> = buildFileParts(
				filePath,
				"image/jpeg",
				filename,
			);
			if (ctx.message.caption) {
				parts.push({ type: "text", text: ctx.message.caption });
			}
			await promptOpenCode(ctx, parts);
		});

		// Video messages
		bot.on("message:video", async (ctx) => {
			const video = ctx.message.video;
			if (video.file_size && video.file_size > TELEGRAM_MAX_FILE_SIZE) {
				sendNotice(
					ctx.api,
					ctx.chat.id,
					"error",
					TELEGRAM_FILE_TOO_LARGE_MESSAGE,
				);
				return;
			}
			const buffer = await downloadTelegramFile(token, video.file_id, bot.api);
			if (!buffer) {
				sendNotice(ctx.api, ctx.chat.id, "error", "Failed to download video.");
				return;
			}
			const mimeType = video.mime_type ?? "video/mp4";
			const filename = resolveFilename(mimeType);
			const filePath = await saveTempFile(buffer, filename);
			const parts: Array<TextPartInput | FilePartInput> = buildFileParts(
				filePath,
				mimeType,
				filename,
			);
			if (ctx.message.caption) {
				parts.push({ type: "text", text: ctx.message.caption });
			}
			await promptOpenCode(ctx, parts);
		});

		// Voice messages
		bot.on("message:voice", async (ctx) => {
			const voice = ctx.message.voice;
			if (voice.file_size && voice.file_size > TELEGRAM_MAX_FILE_SIZE) {
				sendNotice(
					ctx.api,
					ctx.chat.id,
					"error",
					TELEGRAM_FILE_TOO_LARGE_MESSAGE,
				);
				return;
			}
			const buffer = await downloadTelegramFile(token, voice.file_id, bot.api);
			if (!buffer) {
				sendNotice(
					ctx.api,
					ctx.chat.id,
					"error",
					"Failed to download voice message.",
				);
				return;
			}
			const filename = resolveFilename("audio/ogg");
			const filePath = await saveTempFile(buffer, filename);
			const parts: Array<TextPartInput | FilePartInput> = buildFileParts(
				filePath,
				"audio/ogg",
				filename,
			);
			if (ctx.message.caption) {
				parts.push({ type: "text", text: ctx.message.caption });
			}
			await promptOpenCode(ctx, parts);
		});

		// Audio messages
		bot.on("message:audio", async (ctx) => {
			const audio = ctx.message.audio;
			if (audio.file_size && audio.file_size > TELEGRAM_MAX_FILE_SIZE) {
				sendNotice(
					ctx.api,
					ctx.chat.id,
					"error",
					TELEGRAM_FILE_TOO_LARGE_MESSAGE,
				);
				return;
			}
			const buffer = await downloadTelegramFile(token, audio.file_id, bot.api);
			if (!buffer) {
				sendNotice(ctx.api, ctx.chat.id, "error", "Failed to download audio.");
				return;
			}
			const mimeType = audio.mime_type ?? "audio/mpeg";
			const filename = resolveFilename(mimeType, audio.file_name);
			const filePath = await saveTempFile(buffer, filename);
			const parts: Array<TextPartInput | FilePartInput> = buildFileParts(
				filePath,
				mimeType,
				filename,
			);
			if (ctx.message.caption) {
				parts.push({ type: "text", text: ctx.message.caption });
			}
			await promptOpenCode(ctx, parts);
		});

		// Video note messages (round videos)
		bot.on("message:video_note", async (ctx) => {
			const videoNote = ctx.message.video_note;
			if (videoNote.file_size && videoNote.file_size > TELEGRAM_MAX_FILE_SIZE) {
				sendNotice(
					ctx.api,
					ctx.chat.id,
					"error",
					TELEGRAM_FILE_TOO_LARGE_MESSAGE,
				);
				return;
			}
			const buffer = await downloadTelegramFile(
				token,
				videoNote.file_id,
				bot.api,
			);
			if (!buffer) {
				sendNotice(
					ctx.api,
					ctx.chat.id,
					"error",
					"Failed to download video note.",
				);
				return;
			}
			const filename = resolveFilename("video/mp4");
			const filePath = await saveTempFile(buffer, filename);
			const parts: Array<TextPartInput | FilePartInput> = buildFileParts(
				filePath,
				"video/mp4",
				filename,
			);
			await promptOpenCode(ctx, parts);
		});

		// Sticker messages
		bot.on("message:sticker", async (ctx) => {
			const sticker = ctx.message.sticker;
			if (sticker.file_size && sticker.file_size > TELEGRAM_MAX_FILE_SIZE) {
				sendNotice(
					ctx.api,
					ctx.chat.id,
					"error",
					TELEGRAM_FILE_TOO_LARGE_MESSAGE,
				);
				return;
			}
			const buffer = await downloadTelegramFile(
				token,
				sticker.file_id,
				bot.api,
			);
			if (!buffer) {
				sendNotice(
					ctx.api,
					ctx.chat.id,
					"error",
					"Failed to download sticker.",
				);
				return;
			}
			const mimeType = sticker.is_video
				? "video/webm"
				: sticker.is_animated
					? "application/x-tgsticker"
					: "image/webp";
			const filename = resolveFilename(mimeType);
			const filePath = await saveTempFile(buffer, filename);
			const parts: Array<TextPartInput | FilePartInput> = buildFileParts(
				filePath,
				mimeType,
				filename,
			);
			await promptOpenCode(ctx, parts);
		});

		// Document messages
		bot.on("message:document", async (ctx) => {
			const doc = ctx.message.document;
			if (doc.file_size && doc.file_size > TELEGRAM_MAX_FILE_SIZE) {
				sendNotice(
					ctx.api,
					ctx.chat.id,
					"error",
					TELEGRAM_FILE_TOO_LARGE_MESSAGE,
				);
				return;
			}
			const buffer = await downloadTelegramFile(token, doc.file_id, bot.api);
			if (!buffer) {
				sendNotice(
					ctx.api,
					ctx.chat.id,
					"error",
					"Failed to download document.",
				);
				return;
			}
			const mimeType = doc.mime_type ?? "application/octet-stream";
			const filename = resolveFilename(mimeType, doc.file_name);
			const filePath = await saveTempFile(buffer, filename);
			const parts: Array<TextPartInput | FilePartInput> = buildFileParts(
				filePath,
				mimeType,
				filename,
			);
			if (ctx.message.caption) {
				parts.push({ type: "text", text: ctx.message.caption });
			}
			await promptOpenCode(ctx, parts);
		});

		// Error handler
		bot.catch((err) => console.error("[bot] Error:", err));

		// Graceful shutdown
		const shutdown = async () => {
			console.log("[bot] Shutting down...");
			stopTyping();
			stopEventListening();
			await client.mcp
				.disconnect({ name: mcpName, directory: getDirectory() })
				.catch(() => {});
			await mcpServer.close();
			server.close();
			bot.stop();
		};
		process.on("SIGINT", shutdown);
		process.on("SIGTERM", shutdown);

		console.log("[bot] Starting Telegram bot...");
		await bot.start();
	},
});
