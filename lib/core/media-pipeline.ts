/** Pure media helpers — extract descriptors, resolve filenames, build file parts. No IO. */

import path from "node:path";
import type { FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2";
import mime from "mime";
import type { MediaDescriptor } from "./types";

export const TELEGRAM_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB Bot API limit

// ── Media type → descriptor extraction ──────────────────────────────────────

type MediaType =
	| "photo"
	| "video"
	| "voice"
	| "audio"
	| "video_note"
	| "sticker"
	| "document";

/**
 * Extract a unified MediaDescriptor from a Telegram message.
 * Handles per-type quirks (photo arrays, sticker mime detection, etc.)
 */
export function extractMediaDescriptor(
	type: MediaType,
	// biome-ignore lint/suspicious/noExplicitAny: Telegram message types vary per media type
	message: any,
): MediaDescriptor | null {
	switch (type) {
		case "photo": {
			const photos = message.photo;
			if (!Array.isArray(photos) || photos.length === 0) return null;
			const photo = photos[photos.length - 1]; // highest resolution
			return {
				fileId: photo.file_id,
				fileSize: photo.file_size,
				mimeType: "image/jpeg",
				caption: message.caption,
			};
		}
		case "video": {
			const video = message.video;
			if (!video) return null;
			return {
				fileId: video.file_id,
				fileSize: video.file_size,
				mimeType: video.mime_type ?? "video/mp4",
				caption: message.caption,
			};
		}
		case "voice": {
			const voice = message.voice;
			if (!voice) return null;
			return {
				fileId: voice.file_id,
				fileSize: voice.file_size,
				mimeType: "audio/ogg",
				// voice messages don't support captions in the descriptor
			};
		}
		case "audio": {
			const audio = message.audio;
			if (!audio) return null;
			return {
				fileId: audio.file_id,
				fileSize: audio.file_size,
				mimeType: audio.mime_type ?? "audio/mpeg",
				fileName: audio.file_name,
				caption: message.caption,
			};
		}
		case "video_note": {
			const videoNote = message.video_note;
			if (!videoNote) return null;
			return {
				fileId: videoNote.file_id,
				fileSize: videoNote.file_size,
				mimeType: "video/mp4",
				// video_note doesn't support captions
			};
		}
		case "sticker": {
			const sticker = message.sticker;
			if (!sticker) return null;
			const mimeType = sticker.is_video
				? "video/webm"
				: sticker.is_animated
					? "application/x-tgsticker"
					: "image/webp";
			return {
				fileId: sticker.file_id,
				fileSize: sticker.file_size,
				mimeType,
				// stickers don't support captions
			};
		}
		case "document": {
			const doc = message.document;
			if (!doc) return null;
			return {
				fileId: doc.file_id,
				fileSize: doc.file_size,
				mimeType: doc.mime_type ?? "application/octet-stream",
				fileName: doc.file_name,
				caption: message.caption,
			};
		}
	}
}

// ── Filename resolution ─────────────────────────────────────────────────────

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

// ── File parts for OpenCode prompt ──────────────────────────────────────────

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

// ── File validation (used by MCP server) ────────────────────────────────────

export interface FileValidationResult {
	valid: boolean;
	error?: string;
}

export function validateFileForSend(
	exists: boolean,
	isRegularFile: boolean,
	sizeBytes: number,
	filePath: string,
): FileValidationResult {
	if (!exists) {
		return { valid: false, error: `File not found: ${filePath}` };
	}
	if (!isRegularFile) {
		return { valid: false, error: `Not a regular file: ${filePath}` };
	}
	if (sizeBytes > TELEGRAM_MAX_FILE_SIZE) {
		return {
			valid: false,
			error: `File too large (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Telegram limit is 20MB.`,
		};
	}
	return { valid: true };
}

// ── MIME-based Telegram send method selection ───────────────────────────────

export type TelegramSendMethod =
	| "sendPhoto"
	| "sendVideo"
	| "sendVoice"
	| "sendAudio"
	| "sendAnimation"
	| "sendDocument";

export function selectSendMethod(mimeType: string): TelegramSendMethod {
	const baseMime = (mimeType.split(";")[0] ?? mimeType).trim();
	const type = baseMime.split("/")[0];

	if (baseMime === "image/gif") return "sendAnimation";
	if (baseMime === "audio/ogg") return "sendVoice";
	if (type === "image") return "sendPhoto";
	if (type === "video") return "sendVideo";
	if (type === "audio") return "sendAudio";
	return "sendDocument";
}
