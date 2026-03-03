import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Context } from "grammy";
import {
	buildFileParts,
	resolveFilename,
	TELEGRAM_MAX_FILE_SIZE,
} from "~/lib/files";
import { handleMedia, type MediaDescriptor } from "~/lib/media";

// Mock only the I/O functions, keep pure functions from real module
const mockDownload = mock(
	(): Promise<Buffer | null> => Promise.resolve(Buffer.from("fake-file-data")),
);
const mockSaveTempFile = mock(() => "/tmp/openkitten-files/abc/file.jpg");

mock.module("~/lib/files", () => ({
	downloadTelegramFile: mockDownload,
	saveTempFile: mockSaveTempFile,
	resolveFilename,
	buildFileParts,
	TELEGRAM_MAX_FILE_SIZE,
}));

function mockCtx(chatId = 123): Context {
	return {
		chat: { id: chatId },
		api: {
			sendChatAction: mock(() => Promise.resolve(true)),
			sendMessage: mock(() =>
				Promise.resolve({ message_id: 1, date: 0, chat: { id: 1 } }),
			),
		},
	} as unknown as Context;
}

describe("handleMedia pipeline", () => {
	afterEach(() => {
		mockDownload.mockClear();
		mockSaveTempFile.mockClear();
		// Restore default implementation after tests that override it
		mockDownload.mockImplementation(() =>
			Promise.resolve(Buffer.from("fake-file-data")),
		);
	});

	test("downloads, saves, builds parts, and calls promptFn for image", async () => {
		const ctx = mockCtx();
		const promptFn = mock(() => Promise.resolve());
		const media: MediaDescriptor = {
			fileId: "photo-123",
			fileSize: 5000,
			mimeType: "image/jpeg",
			caption: "A nice photo",
			label: "photo",
		};

		await handleMedia(ctx, media, "bot-token", promptFn);

		// Download was called with correct args
		expect(mockDownload).toHaveBeenCalledWith(
			"bot-token",
			"photo-123",
			ctx.api,
		);
		// File was saved
		expect(mockSaveTempFile).toHaveBeenCalled();
		// promptFn was called with file parts + caption
		expect(promptFn).toHaveBeenCalledTimes(1);
		const parts = (promptFn.mock.calls[0] as unknown[])[1] as Array<{
			type: string;
		}>;
		// Image: file part + text caption
		expect(parts.length).toBe(2);
		expect(parts[0]?.type).toBe("file");
		expect(parts[1]?.type).toBe("text");
	});

	test("downloads and builds text part for non-image file", async () => {
		const ctx = mockCtx();
		const promptFn = mock(() => Promise.resolve());
		const media: MediaDescriptor = {
			fileId: "doc-456",
			fileSize: 1000,
			mimeType: "application/pdf",
			filename: "report.pdf",
			label: "document",
		};

		await handleMedia(ctx, media, "bot-token", promptFn);

		expect(promptFn).toHaveBeenCalledTimes(1);
		const parts = (promptFn.mock.calls[0] as unknown[])[1] as Array<{
			type: string;
			text?: string;
		}>;
		// Non-image: text description part (no caption)
		expect(parts.length).toBe(1);
		expect(parts[0]?.type).toBe("text");
		expect(parts[0]?.text).toContain("report.pdf");
	});

	test("rejects files exceeding 20MB limit", async () => {
		const ctx = mockCtx();
		const promptFn = mock(() => Promise.resolve());
		const media: MediaDescriptor = {
			fileId: "big-file",
			fileSize: TELEGRAM_MAX_FILE_SIZE + 1,
			mimeType: "video/mp4",
			label: "video",
		};

		await handleMedia(ctx, media, "bot-token", promptFn);

		// promptFn should NOT be called
		expect(promptFn).not.toHaveBeenCalled();
		// Download should not be attempted
		expect(mockDownload).not.toHaveBeenCalled();
		// Error notice should be sent
		const sendCalls = (ctx.api.sendMessage as ReturnType<typeof mock>).mock
			.calls;
		expect(sendCalls.length).toBeGreaterThanOrEqual(1);
	});

	test("sends error notice when download fails", async () => {
		mockDownload.mockImplementationOnce(() => Promise.resolve(null));

		const ctx = mockCtx();
		const promptFn = mock(() => Promise.resolve());
		const media: MediaDescriptor = {
			fileId: "broken-file",
			fileSize: 1000,
			mimeType: "image/png",
			label: "photo",
		};

		await handleMedia(ctx, media, "bot-token", promptFn);

		expect(promptFn).not.toHaveBeenCalled();
		const sendCalls = (ctx.api.sendMessage as ReturnType<typeof mock>).mock
			.calls;
		expect(sendCalls.length).toBeGreaterThanOrEqual(1);
	});

	test("does nothing when ctx.chat is missing", async () => {
		const ctx = { chat: undefined, api: {} } as unknown as Context;
		const promptFn = mock(() => Promise.resolve());
		const media: MediaDescriptor = {
			fileId: "f1",
			mimeType: "image/jpeg",
			label: "photo",
		};

		await handleMedia(ctx, media, "token", promptFn);

		expect(promptFn).not.toHaveBeenCalled();
		expect(mockDownload).not.toHaveBeenCalled();
	});

	test("includes caption as text part when present", async () => {
		const ctx = mockCtx();
		const promptFn = mock(() => Promise.resolve());
		const media: MediaDescriptor = {
			fileId: "f1",
			fileSize: 500,
			mimeType: "image/png",
			caption: "Look at this!",
			label: "photo",
		};

		await handleMedia(ctx, media, "token", promptFn);

		const parts = (promptFn.mock.calls[0] as unknown[])[1] as Array<{
			type: string;
			text?: string;
		}>;
		const captionPart = parts.find(
			(p) => p.type === "text" && p.text === "Look at this!",
		);
		expect(captionPart).toBeTruthy();
	});

	test("omits caption text part when no caption", async () => {
		const ctx = mockCtx();
		const promptFn = mock(() => Promise.resolve());
		const media: MediaDescriptor = {
			fileId: "f1",
			fileSize: 500,
			mimeType: "image/png",
			label: "photo",
		};

		await handleMedia(ctx, media, "token", promptFn);

		const parts = (promptFn.mock.calls[0] as unknown[])[1] as Array<{
			type: string;
		}>;
		// Only file part, no text caption
		expect(parts.length).toBe(1);
		expect(parts[0]?.type).toBe("file");
	});
});
