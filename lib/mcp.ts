import nodePath from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Api } from "grammy";
import mime from "mime";
import { z } from "zod";
import { BOT_HOSTNAME } from "~/lib/constants/bot";
import {
	MCP_SERVER_IDLE_TIMEOUT_SECONDS,
	MCP_SERVER_NAME,
	MCP_SERVER_PATH,
	MCP_SERVER_VERSION,
} from "~/lib/constants/mcp";
import { TELEGRAM_MAX_FILE_SIZE } from "~/lib/constants/telegram";
import { sendTelegramFile } from "~/lib/files";

let telegramApi: Api | null = null;
let telegramChatId: number | null = null;

export function setTelegramContext(api: Api, chatId: number): void {
	telegramApi = api;
	telegramChatId = chatId;
}

function createMcpServer(): McpServer {
	const server = new McpServer({
		name: MCP_SERVER_NAME,
		version: MCP_SERVER_VERSION,
	});

	// @ts-expect-error -- deep type instantiation in server.tool()
	server.tool(
		"send_file",
		"Send a file to the user on Telegram. Automatically detects the file type and sends it as a photo, video, audio, voice message, GIF, or document based on the MIME type.",
		{
			path: z.string().describe("Absolute path to the file to send"),
			caption: z
				.string()
				.optional()
				.describe("Caption to display with the file"),
		},
		async ({ path: rawPath, caption }) => {
			const resolved = nodePath.resolve(rawPath);
			const file = Bun.file(resolved);

			if (!(await file.exists())) {
				return {
					content: [{ type: "text", text: `File not found: ${resolved}` }],
					isError: true,
				};
			}

			if (file.size > TELEGRAM_MAX_FILE_SIZE) {
				return {
					content: [
						{
							type: "text",
							text: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Telegram limit is 20MB.`,
						},
					],
					isError: true,
				};
			}

			if (!telegramApi || !telegramChatId) {
				return {
					content: [{ type: "text", text: "Telegram context not available." }],
					isError: true,
				};
			}

			const detectedMime = mime.getType(resolved) ?? "application/octet-stream";
			const filename = nodePath.basename(resolved);

			try {
				await sendTelegramFile(
					telegramApi,
					telegramChatId,
					resolved,
					detectedMime,
					filename,
					caption,
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return {
					content: [{ type: "text", text: `Failed to send file: ${msg}` }],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text",
						text: `File "${filename}" sent to Telegram.`,
					},
				],
			};
		},
	);

	return server;
}

export async function startMcpServer(): Promise<{
	url: string;
	close: () => Promise<void>;
}> {
	const httpServer = Bun.serve({
		hostname: BOT_HOSTNAME,
		port: 0,
		idleTimeout: MCP_SERVER_IDLE_TIMEOUT_SECONDS,
		async fetch(req) {
			const url = new URL(req.url);
			if (url.pathname !== MCP_SERVER_PATH) {
				return new Response("Not Found", { status: 404 });
			}

			// Stateless: create a new server + transport per request to avoid
			// transport replacement races on concurrent calls
			const mcpServer = createMcpServer();
			const transport = new WebStandardStreamableHTTPServerTransport({
				sessionIdGenerator: undefined,
			});
			await mcpServer.connect(transport);
			return transport.handleRequest(req);
		},
	});

	const url = `http://${BOT_HOSTNAME}:${httpServer.port}${MCP_SERVER_PATH}`;

	return {
		url,
		async close() {
			httpServer.stop(true);
		},
	};
}
