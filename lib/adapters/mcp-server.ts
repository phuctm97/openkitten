/**
 * Standalone MCP server — exposes `send_files` tool.
 * Spawned by OpenKitten as a subprocess, runs OUTSIDE the sandbox.
 * Sends files directly to Telegram using the Bot API.
 *
 * Required env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 *
 * Uses stdio transport (most reliable with Bun).
 */

import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import mime from "mime";
import {
	selectSendMethod,
	validateFileForSend,
} from "~/lib/core/media-pipeline";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !chatId) {
	process.stderr.write(
		"MCP server requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars\n",
	);
	process.exit(1);
}

const numericChatId = Number(chatId);

// ── Telegram file sending ───────────────────────────────────────────────────

async function sendFileToTelegram(
	filePath: string,
): Promise<{ ok: boolean; error?: string }> {
	const file = Bun.file(filePath);

	const exists = await file.exists();
	let isRegFile = false;
	let size = 0;
	if (exists) {
		const fs = require("node:fs");
		const stats = fs.statSync(filePath);
		isRegFile = stats.isFile();
		size = stats.size;
	}

	const validation = validateFileForSend(exists, isRegFile, size, filePath);
	if (!validation.valid) {
		return { ok: false, error: validation.error };
	}

	const mimeType = mime.getType(filePath) ?? "application/octet-stream";
	const method = selectSendMethod(mimeType);
	const filename = path.basename(filePath);

	const formData = new FormData();
	formData.append("chat_id", String(numericChatId));

	const blob = new Blob([await file.arrayBuffer()], { type: mimeType });

	const fieldMap: Record<string, string> = {
		sendPhoto: "photo",
		sendVideo: "video",
		sendVoice: "voice",
		sendAudio: "audio",
		sendAnimation: "animation",
		sendDocument: "document",
	};
	formData.append(fieldMap[method] ?? "document", blob, filename);

	const url = `https://api.telegram.org/bot${token}/${method}`;
	const res = await fetch(url, { method: "POST", body: formData });

	if (!res.ok) {
		const body = await res.text();
		return { ok: false, error: `Telegram API error: ${res.status} ${body}` };
	}

	return { ok: true };
}

// ── MCP Server setup (low-level Server API) ─────────────────────────────────

const server = new Server(
	{ name: "openkitten", version: "1.0.0" },
	{ capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: [
		{
			name: "send_files",
			description:
				"Send files to the user on Telegram. Supports images, documents, audio, video, etc.",
			inputSchema: {
				type: "object" as const,
				properties: {
					files: {
						type: "array" as const,
						items: { type: "string" as const },
						description: "Array of absolute file paths to send",
					},
					caption: {
						type: "string" as const,
						description: "Optional caption to send after the files",
					},
				},
				required: ["files"],
			},
		},
	],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	if (request.params.name !== "send_files") {
		return {
			content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
			isError: true,
		};
	}

	const args = request.params.arguments as {
		files: string[];
		caption?: string;
	};
	const results: string[] = [];
	let allOk = true;

	for (const filePath of args.files) {
		const resolved = path.resolve(filePath);
		const result = await sendFileToTelegram(resolved);
		if (result.ok) {
			results.push(`Sent: ${path.basename(resolved)}`);
		} else {
			results.push(`Failed: ${path.basename(resolved)} — ${result.error}`);
			allOk = false;
		}
	}

	if (args.caption) {
		const captionUrl = `https://api.telegram.org/bot${token}/sendMessage`;
		const captionRes = await fetch(captionUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ chat_id: numericChatId, text: args.caption }),
		});
		if (!captionRes.ok) {
			results.push("Failed to send caption");
			allOk = false;
		}
	}

	return {
		content: [{ type: "text", text: results.join("\n") }],
		isError: !allOk,
	};
});

// ── Start stdio transport ───────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
