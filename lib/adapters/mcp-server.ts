/**
 * MCP server — exposes `send_files` tool via Streamable HTTP transport.
 * Runs in-process with Bun.serve() on a dynamic port.
 * Sends files directly to Telegram using the Bot API.
 */

import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import mime from "mime";
import { z } from "zod";
import {
	selectSendMethod,
	validateFileForSend,
} from "~/lib/core/media-pipeline";

// ── Telegram file sending ───────────────────────────────────────────────────

async function sendFileToTelegram(
	filePath: string,
	token: string,
	chatId: number,
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
	formData.append("chat_id", String(chatId));

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

// ── Public API ──────────────────────────────────────────────────────────────

export interface McpServerHandle {
	url: string;
	stop(): void;
}

export async function startMcpServer(
	token: string,
	chatId: number,
): Promise<McpServerHandle> {
	const mcpServer = new McpServer({ name: "openkitten", version: "1.0.0" });

	// @ts-expect-error — McpServer generics cause TS2589 with zod; runtime works fine
	mcpServer.tool(
		"send_files",
		"Send files to the user on Telegram. Supports images, documents, audio, video, etc.",
		{
			files: z
				.array(z.string())
				.describe("Array of absolute file paths to send"),
			caption: z
				.string()
				.optional()
				.describe("Optional caption to send after the files"),
		},
		async ({ files, caption }) => {
			const results: string[] = [];
			let allOk = true;

			for (const filePath of files) {
				const resolved = path.resolve(filePath);
				const result = await sendFileToTelegram(resolved, token, chatId);
				if (result.ok) {
					results.push(`Sent: ${path.basename(resolved)}`);
				} else {
					results.push(`Failed: ${path.basename(resolved)} — ${result.error}`);
					allOk = false;
				}
			}

			if (caption) {
				const captionUrl = `https://api.telegram.org/bot${token}/sendMessage`;
				const captionRes = await fetch(captionUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ chat_id: chatId, text: caption }),
				});
				if (!captionRes.ok) {
					results.push("Failed to send caption");
					allOk = false;
				}
			}

			return {
				content: [{ type: "text" as const, text: results.join("\n") }],
				isError: !allOk,
			};
		},
	);

	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: () => crypto.randomUUID(),
	});

	await mcpServer.connect(transport);

	const httpServer = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch: (req) => transport.handleRequest(req),
	});

	const url = `http://127.0.0.1:${httpServer.port}`;

	return {
		url,
		stop() {
			httpServer.stop();
			mcpServer.close().catch(() => {});
		},
	};
}
