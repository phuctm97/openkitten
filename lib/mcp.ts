import nodePath from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Api } from "grammy";
import mime from "mime";
import { z } from "zod";
import { sendTelegramFile } from "~/lib/files";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB Telegram Bot API limit

let telegramApi: Api | null = null;
let telegramChatId: number | null = null;

export function setTelegramContext(api: Api, chatId: number): void {
	telegramApi = api;
	telegramChatId = chatId;
}

interface ToolDef {
	description: string;
	validate: (mimeType: string) => boolean;
}

const TOOLS: Record<string, ToolDef> = {
	send_photo: {
		description: "Send an image to the user on Telegram",
		validate: (m) => m.startsWith("image/") && m !== "image/gif",
	},
	send_animation: {
		description: "Send a GIF to the user on Telegram",
		validate: (m) => m === "image/gif",
	},
	send_video: {
		description: "Send a video to the user on Telegram",
		validate: (m) => m.startsWith("video/"),
	},
	send_audio: {
		description: "Send an audio file to the user on Telegram",
		validate: (m) => m.startsWith("audio/") && m !== "audio/ogg",
	},
	send_voice: {
		description: "Send a voice message to the user on Telegram",
		validate: (m) => m === "audio/ogg",
	},
	send_document: {
		description: "Send any file as a document to the user on Telegram",
		validate: () => true,
	},
};

const inputSchema = {
	path: z.string().describe("Absolute path to the file to send"),
	caption: z.string().optional().describe("Caption to display with the file"),
};

function createHandler(
	toolName: string,
	def: ToolDef,
): (args: { path: string; caption?: string }) => Promise<CallToolResult> {
	return async ({ path: rawPath, caption }) => {
		const resolved = nodePath.resolve(rawPath);
		const file = Bun.file(resolved);

		if (!(await file.exists())) {
			return {
				content: [{ type: "text", text: `File not found: ${resolved}` }],
				isError: true,
			};
		}

		if (file.size > MAX_FILE_SIZE) {
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

		const detectedMime = mime.getType(resolved) ?? "application/octet-stream";

		if (toolName !== "send_document" && !def.validate(detectedMime)) {
			return {
				content: [
					{
						type: "text",
						text: `Invalid MIME type "${detectedMime}" for ${toolName}. Use send_document for this file type.`,
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

		const filename = nodePath.basename(resolved);
		// Force document delivery regardless of MIME when send_document is used
		const sendMime =
			toolName === "send_document" ? "application/octet-stream" : detectedMime;
		try {
			await sendTelegramFile(
				telegramApi,
				telegramChatId,
				resolved,
				sendMime,
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
	};
}

function createMcpServer(): McpServer {
	const server = new McpServer({
		name: "openkitten-telegram",
		version: "1.0.0",
	});

	for (const [name, def] of Object.entries(TOOLS)) {
		// @ts-expect-error -- deep type instantiation in loop over server.tool()
		server.tool(name, def.description, inputSchema, createHandler(name, def));
	}

	return server;
}

export async function startMcpServer(
	port: number,
): Promise<{ url: string; close: () => Promise<void> }> {
	const httpServer = Bun.serve({
		hostname: "127.0.0.1",
		port,
		idleTimeout: 255,
		async fetch(req) {
			const url = new URL(req.url);
			if (url.pathname !== "/mcp") {
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

	const url = `http://127.0.0.1:${httpServer.port}/mcp`;

	return {
		url,
		async close() {
			httpServer.stop(true);
		},
	};
}
