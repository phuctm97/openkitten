import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2";
import type { Api } from "grammy";
import { InputFile } from "grammy";
import mime from "mime";
import { nanoid } from "nanoid";

export const TELEGRAM_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB Bot API limit
const TELEGRAM_DOWNLOAD_TIMEOUT_MS = 60_000;
const TEMP_DIR = path.join(tmpdir(), "openkitten-files");

export async function downloadTelegramFile(
	token: string,
	fileId: string,
	api: Api,
): Promise<Buffer | null> {
	try {
		const file = await api.getFile(fileId);
		if (!file.file_path) {
			console.error("[files] getFile returned no file_path:", fileId);
			return null;
		}
		const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
		const res = await fetch(url, {
			signal: AbortSignal.timeout(TELEGRAM_DOWNLOAD_TIMEOUT_MS),
		});
		if (!res.ok) {
			console.error("[files] fetch failed:", res.status, fileId);
			return null;
		}
		return Buffer.from(await res.arrayBuffer());
	} catch (err) {
		console.error("[files] download error:", err);
		return null;
	}
}

export async function saveTempFile(
	buffer: Buffer,
	filename: string,
): Promise<string> {
	const subDir = path.join(TEMP_DIR, nanoid());
	mkdirSync(subDir, { recursive: true });
	const filePath = path.join(subDir, path.basename(filename));
	await Bun.write(filePath, buffer);
	return filePath;
}

export function resolveFilename(mimeType: string, filename?: string): string {
	const baseMime = (mimeType.split(";")[0] ?? mimeType).trim();
	const ext = mime.getExtension(baseMime) ?? "bin";
	if (!filename) return `file.${ext}`;

	// Strip directory components
	let name = path.basename(filename);
	// Strip dangerous characters (keep alphanumeric, dots, hyphens, underscores, spaces)
	name = name.replace(/[^\p{L}\p{N}._\- ]/gu, "_");
	// Collapse multiple underscores/spaces
	name = name.replace(/[_ ]{2,}/g, "_");
	// Strip leading dots (hidden files)
	name = name.replace(/^\.+/, "");

	if (!name || name === `.${ext}` || name === ext) return `file.${ext}`;
	return name;
}

export function buildFileParts(
	filePath: string,
	mimeType: string,
	filename: string,
): Array<TextPartInput | FilePartInput> {
	const baseMime = (mimeType.split(";")[0] ?? mimeType).trim();
	if (baseMime.startsWith("image/")) {
		return [
			{ type: "file", mime: baseMime, filename, url: `file://${filePath}` },
		];
	}
	return [
		{
			type: "text",
			text: `[File received: ${filename} (${baseMime}) saved at ${filePath} — use your tools to read or process this file]`,
		},
	];
}

export async function sendTelegramFile(
	api: Api,
	chatId: number,
	url: string,
	mimeType: string,
	filename?: string,
	caption?: string,
): Promise<void> {
	let buffer: Buffer;

	if (url.startsWith("file://")) {
		buffer = Buffer.from(await Bun.file(url.slice(7)).arrayBuffer());
	} else if (url.startsWith("http://") || url.startsWith("https://")) {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(TELEGRAM_DOWNLOAD_TIMEOUT_MS),
		});
		if (!res.ok) {
			throw new Error(`Failed to fetch file: HTTP ${res.status} for ${url}`);
		}
		buffer = Buffer.from(await res.arrayBuffer());
	} else {
		// Treat as absolute path
		buffer = Buffer.from(await Bun.file(url).arrayBuffer());
	}

	const name = resolveFilename(mimeType, filename);
	const inputFile = new InputFile(buffer, name);
	const baseMime = (mimeType.split(";")[0] ?? mimeType).trim();
	const type = baseMime.split("/")[0];

	const opts = caption ? { caption } : {};

	if (baseMime === "image/gif") {
		await api.sendAnimation(chatId, inputFile, opts);
	} else if (baseMime === "audio/ogg") {
		await api.sendVoice(chatId, inputFile, opts);
	} else if (type === "image") {
		await api.sendPhoto(chatId, inputFile, opts);
	} else if (type === "video") {
		await api.sendVideo(chatId, inputFile, opts);
	} else if (type === "audio") {
		await api.sendAudio(chatId, inputFile, opts);
	} else {
		await api.sendDocument(chatId, inputFile, opts);
	}
}
