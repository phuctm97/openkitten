import { describe, expect, test } from "bun:test";
import type { Context } from "grammy";
import {
	extractAudio,
	extractDocument,
	extractPhoto,
	extractSticker,
	extractVideo,
	extractVideoNote,
	extractVoice,
	type MediaDescriptor,
} from "~/lib/media";

// Minimal mock context factory
function mockCtx(message: Record<string, unknown> = {}): Context {
	return { message } as unknown as Context;
}

describe("extractPhoto", () => {
	test("extracts photo from context", () => {
		const ctx = mockCtx({
			photo: [
				{ file_id: "small", file_size: 100 },
				{ file_id: "large", file_size: 5000 },
			],
			caption: "A nice photo",
		});
		const result = extractPhoto(ctx);
		expect(result).not.toBeNull();
		expect(result!.fileId).toBe("large");
		expect(result!.mimeType).toBe("image/jpeg");
		expect(result!.caption).toBe("A nice photo");
		expect(result!.label).toBe("photo");
	});

	test("returns null when no photo", () => {
		expect(extractPhoto(mockCtx({}))).toBeNull();
	});

	test("returns null for empty photo array", () => {
		expect(extractPhoto(mockCtx({ photo: [] }))).toBeNull();
	});
});

describe("extractVideo", () => {
	test("extracts video with mime type", () => {
		const ctx = mockCtx({
			video: {
				file_id: "vid1",
				file_size: 10000,
				mime_type: "video/webm",
			},
			caption: "Video caption",
		});
		const result = extractVideo(ctx);
		expect(result).not.toBeNull();
		expect(result!.fileId).toBe("vid1");
		expect(result!.mimeType).toBe("video/webm");
	});

	test("defaults to video/mp4 when no mime_type", () => {
		const ctx = mockCtx({
			video: { file_id: "vid2", file_size: 10000 },
		});
		const result = extractVideo(ctx);
		expect(result!.mimeType).toBe("video/mp4");
	});

	test("returns null when no video", () => {
		expect(extractVideo(mockCtx({}))).toBeNull();
	});
});

describe("extractVoice", () => {
	test("extracts voice message", () => {
		const ctx = mockCtx({
			voice: { file_id: "voice1", file_size: 500 },
		});
		const result = extractVoice(ctx);
		expect(result).not.toBeNull();
		expect(result!.mimeType).toBe("audio/ogg");
		expect(result!.label).toBe("voice message");
	});

	test("returns null when no voice", () => {
		expect(extractVoice(mockCtx({}))).toBeNull();
	});
});

describe("extractAudio", () => {
	test("extracts audio with filename", () => {
		const ctx = mockCtx({
			audio: {
				file_id: "aud1",
				file_size: 3000,
				mime_type: "audio/mpeg",
				file_name: "song.mp3",
			},
		});
		const result = extractAudio(ctx);
		expect(result).not.toBeNull();
		expect(result!.filename).toBe("song.mp3");
		expect(result!.mimeType).toBe("audio/mpeg");
	});

	test("defaults to audio/mpeg when no mime_type", () => {
		const ctx = mockCtx({
			audio: { file_id: "aud2", file_size: 3000 },
		});
		const result = extractAudio(ctx);
		expect(result!.mimeType).toBe("audio/mpeg");
	});
});

describe("extractVideoNote", () => {
	test("extracts video note", () => {
		const ctx = mockCtx({
			video_note: { file_id: "vn1", file_size: 2000 },
		});
		const result = extractVideoNote(ctx);
		expect(result).not.toBeNull();
		expect(result!.mimeType).toBe("video/mp4");
		expect(result!.label).toBe("video note");
		expect(result!.caption).toBeUndefined();
	});
});

describe("extractSticker", () => {
	test("extracts static sticker as image/webp", () => {
		const ctx = mockCtx({
			sticker: { file_id: "st1", file_size: 100 },
		});
		const result = extractSticker(ctx);
		expect(result!.mimeType).toBe("image/webp");
	});

	test("extracts video sticker as video/webm", () => {
		const ctx = mockCtx({
			sticker: { file_id: "st2", file_size: 100, is_video: true },
		});
		const result = extractSticker(ctx);
		expect(result!.mimeType).toBe("video/webm");
	});

	test("extracts animated sticker", () => {
		const ctx = mockCtx({
			sticker: { file_id: "st3", file_size: 100, is_animated: true },
		});
		const result = extractSticker(ctx);
		expect(result!.mimeType).toBe("application/x-tgsticker");
	});
});

describe("extractDocument", () => {
	test("extracts document with all fields", () => {
		const ctx = mockCtx({
			document: {
				file_id: "doc1",
				file_size: 8000,
				mime_type: "application/pdf",
				file_name: "report.pdf",
			},
			caption: "My report",
		});
		const result = extractDocument(ctx);
		expect(result).not.toBeNull();
		expect(result!.filename).toBe("report.pdf");
		expect(result!.caption).toBe("My report");
	});

	test("defaults to application/octet-stream", () => {
		const ctx = mockCtx({
			document: { file_id: "doc2", file_size: 8000 },
		});
		const result = extractDocument(ctx);
		expect(result!.mimeType).toBe("application/octet-stream");
	});
});

describe("MediaDescriptor", () => {
	test("all extractors return correct label", () => {
		const cases: Array<{
			fn: (ctx: Context) => MediaDescriptor | null;
			msg: Record<string, unknown>;
			label: string;
		}> = [
			{
				fn: extractPhoto,
				msg: { photo: [{ file_id: "f", file_size: 1 }] },
				label: "photo",
			},
			{
				fn: extractVideo,
				msg: { video: { file_id: "f", file_size: 1 } },
				label: "video",
			},
			{
				fn: extractVoice,
				msg: { voice: { file_id: "f", file_size: 1 } },
				label: "voice message",
			},
			{
				fn: extractAudio,
				msg: { audio: { file_id: "f", file_size: 1 } },
				label: "audio",
			},
			{
				fn: extractVideoNote,
				msg: { video_note: { file_id: "f", file_size: 1 } },
				label: "video note",
			},
			{
				fn: extractSticker,
				msg: { sticker: { file_id: "f", file_size: 1 } },
				label: "sticker",
			},
			{
				fn: extractDocument,
				msg: { document: { file_id: "f", file_size: 1 } },
				label: "document",
			},
		];

		for (const { fn, msg, label } of cases) {
			const result = fn(mockCtx(msg));
			expect(result).not.toBeNull();
			expect(result!.label).toBe(label);
		}
	});
});
