import type { FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2";
import type { Bot, Context } from "grammy";
import {
	buildFileParts,
	downloadTelegramFile,
	resolveFilename,
	saveTempFile,
	TELEGRAM_MAX_FILE_SIZE,
} from "~/lib/files";
import { sendNotice } from "~/lib/notice";

export interface MediaDescriptor {
	fileId: string;
	fileSize?: number;
	mimeType: string;
	filename?: string;
	caption?: string;
	label: string;
}

export function extractPhoto(ctx: Context): MediaDescriptor | null {
	const photo = ctx.message?.photo?.at(-1);
	if (!photo) return null;
	return {
		fileId: photo.file_id,
		fileSize: photo.file_size,
		mimeType: "image/jpeg",
		caption: ctx.message?.caption,
		label: "photo",
	};
}

export function extractVideo(ctx: Context): MediaDescriptor | null {
	const video = ctx.message?.video;
	if (!video) return null;
	return {
		fileId: video.file_id,
		fileSize: video.file_size,
		mimeType: video.mime_type ?? "video/mp4",
		caption: ctx.message?.caption,
		label: "video",
	};
}

export function extractVoice(ctx: Context): MediaDescriptor | null {
	const voice = ctx.message?.voice;
	if (!voice) return null;
	return {
		fileId: voice.file_id,
		fileSize: voice.file_size,
		mimeType: "audio/ogg",
		caption: ctx.message?.caption,
		label: "voice message",
	};
}

export function extractAudio(ctx: Context): MediaDescriptor | null {
	const audio = ctx.message?.audio;
	if (!audio) return null;
	return {
		fileId: audio.file_id,
		fileSize: audio.file_size,
		mimeType: audio.mime_type ?? "audio/mpeg",
		filename: audio.file_name,
		caption: ctx.message?.caption,
		label: "audio",
	};
}

export function extractVideoNote(ctx: Context): MediaDescriptor | null {
	const videoNote = ctx.message?.video_note;
	if (!videoNote) return null;
	return {
		fileId: videoNote.file_id,
		fileSize: videoNote.file_size,
		mimeType: "video/mp4",
		label: "video note",
	};
}

export function extractSticker(ctx: Context): MediaDescriptor | null {
	const sticker = ctx.message?.sticker;
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
		label: "sticker",
	};
}

export function extractDocument(ctx: Context): MediaDescriptor | null {
	const doc = ctx.message?.document;
	if (!doc) return null;
	return {
		fileId: doc.file_id,
		fileSize: doc.file_size,
		mimeType: doc.mime_type ?? "application/octet-stream",
		filename: doc.file_name,
		caption: ctx.message?.caption,
		label: "document",
	};
}

export async function handleMedia(
	ctx: Context,
	media: MediaDescriptor,
	token: string,
	api: Bot["api"],
	promptFn: (
		ctx: Context,
		parts: Array<TextPartInput | FilePartInput>,
	) => Promise<void>,
): Promise<void> {
	const chatId = ctx.chat?.id;
	if (!chatId) return;

	if (media.fileSize && media.fileSize > TELEGRAM_MAX_FILE_SIZE) {
		sendNotice(ctx.api, chatId, "error", "File too large (max 20MB).");
		return;
	}

	const buffer = await downloadTelegramFile(token, media.fileId, api);
	if (!buffer) {
		sendNotice(ctx.api, chatId, "error", `Failed to download ${media.label}.`);
		return;
	}

	const filename = resolveFilename(media.mimeType, media.filename);
	const filePath = saveTempFile(buffer, filename);
	const parts: Array<TextPartInput | FilePartInput> = buildFileParts(
		filePath,
		media.mimeType,
		filename,
	);
	if (media.caption) {
		parts.push({ type: "text", text: media.caption });
	}
	await promptFn(ctx, parts);
}

export function registerMediaHandlers(
	bot: Bot,
	token: string,
	promptFn: (
		ctx: Context,
		parts: Array<TextPartInput | FilePartInput>,
	) => Promise<void>,
): void {
	bot.on("message:photo", async (ctx) => {
		const media = extractPhoto(ctx);
		if (media) await handleMedia(ctx, media, token, bot.api, promptFn);
	});

	bot.on("message:video", async (ctx) => {
		const media = extractVideo(ctx);
		if (media) await handleMedia(ctx, media, token, bot.api, promptFn);
	});

	bot.on("message:voice", async (ctx) => {
		const media = extractVoice(ctx);
		if (media) await handleMedia(ctx, media, token, bot.api, promptFn);
	});

	bot.on("message:audio", async (ctx) => {
		const media = extractAudio(ctx);
		if (media) await handleMedia(ctx, media, token, bot.api, promptFn);
	});

	bot.on("message:video_note", async (ctx) => {
		const media = extractVideoNote(ctx);
		if (media) await handleMedia(ctx, media, token, bot.api, promptFn);
	});

	bot.on("message:sticker", async (ctx) => {
		const media = extractSticker(ctx);
		if (media) await handleMedia(ctx, media, token, bot.api, promptFn);
	});

	bot.on("message:document", async (ctx) => {
		const media = extractDocument(ctx);
		if (media) await handleMedia(ctx, media, token, bot.api, promptFn);
	});
}
