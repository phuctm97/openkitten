import { describe, expect, it } from "bun:test";
import {
	buildFileParts,
	extractMediaDescriptor,
	resolveFilename,
	selectSendMethod,
	validateFileForSend,
} from "~/lib/core/media-pipeline";

describe("extractMediaDescriptor", () => {
	it("extracts photo (last element, fixed jpeg mime)", () => {
		const message = {
			photo: [
				{ file_id: "small", file_size: 100 },
				{ file_id: "large", file_size: 500 },
			],
			caption: "My photo",
		};
		const desc = extractMediaDescriptor("photo", message);
		expect(desc).not.toBeNull();
		expect(desc?.fileId).toBe("large");
		expect(desc?.mimeType).toBe("image/jpeg");
		expect(desc?.caption).toBe("My photo");
	});

	it("extracts video with default mime", () => {
		const message = {
			video: { file_id: "v1", file_size: 1000 },
			caption: "cap",
		};
		const desc = extractMediaDescriptor("video", message);
		expect(desc?.mimeType).toBe("video/mp4");
		expect(desc?.caption).toBe("cap");
	});

	it("extracts video with custom mime", () => {
		const message = {
			video: { file_id: "v2", mime_type: "video/webm" },
		};
		const desc = extractMediaDescriptor("video", message);
		expect(desc?.mimeType).toBe("video/webm");
	});

	it("extracts voice with fixed ogg mime", () => {
		const message = { voice: { file_id: "voice1", file_size: 200 } };
		const desc = extractMediaDescriptor("voice", message);
		expect(desc?.mimeType).toBe("audio/ogg");
		expect(desc?.caption).toBeUndefined();
	});

	it("extracts audio with file_name", () => {
		const message = {
			audio: {
				file_id: "a1",
				mime_type: "audio/mpeg",
				file_name: "song.mp3",
			},
			caption: "A song",
		};
		const desc = extractMediaDescriptor("audio", message);
		expect(desc?.fileName).toBe("song.mp3");
		expect(desc?.mimeType).toBe("audio/mpeg");
	});

	it("extracts video_note with fixed mp4 mime", () => {
		const message = { video_note: { file_id: "vn1", file_size: 300 } };
		const desc = extractMediaDescriptor("video_note", message);
		expect(desc?.mimeType).toBe("video/mp4");
	});

	it("extracts sticker — regular webp", () => {
		const message = {
			sticker: { file_id: "s1", is_video: false, is_animated: false },
		};
		const desc = extractMediaDescriptor("sticker", message);
		expect(desc?.mimeType).toBe("image/webp");
	});

	it("extracts sticker — video", () => {
		const message = {
			sticker: { file_id: "s2", is_video: true, is_animated: false },
		};
		const desc = extractMediaDescriptor("sticker", message);
		expect(desc?.mimeType).toBe("video/webm");
	});

	it("extracts sticker — animated", () => {
		const message = {
			sticker: { file_id: "s3", is_video: false, is_animated: true },
		};
		const desc = extractMediaDescriptor("sticker", message);
		expect(desc?.mimeType).toBe("application/x-tgsticker");
	});

	it("extracts document with all fields", () => {
		const message = {
			document: {
				file_id: "d1",
				file_size: 5000,
				mime_type: "application/pdf",
				file_name: "report.pdf",
			},
			caption: "Report",
		};
		const desc = extractMediaDescriptor("document", message);
		expect(desc?.fileId).toBe("d1");
		expect(desc?.mimeType).toBe("application/pdf");
		expect(desc?.fileName).toBe("report.pdf");
		expect(desc?.caption).toBe("Report");
	});

	it("returns null for empty photo array", () => {
		expect(extractMediaDescriptor("photo", { photo: [] })).toBeNull();
	});

	it("returns null for missing media field", () => {
		expect(extractMediaDescriptor("video", {})).toBeNull();
		expect(extractMediaDescriptor("document", {})).toBeNull();
	});
});

describe("resolveFilename", () => {
	it("generates default name for no filename", () => {
		expect(resolveFilename("image/jpeg")).toBe("file.jpg");
		expect(resolveFilename("application/pdf")).toBe("file.pdf");
	});

	it("sanitizes dangerous characters", () => {
		expect(resolveFilename("text/plain", "../../etc/passwd")).toBe("passwd");
	});

	it("strips leading dots", () => {
		expect(resolveFilename("text/plain", ".hidden")).toBe("hidden");
	});

	it("preserves valid filenames", () => {
		expect(resolveFilename("image/png", "photo.png")).toBe("photo.png");
	});

	it("collapses multiple underscores", () => {
		expect(resolveFilename("text/plain", "a___b.txt")).toBe("a_b.txt");
	});
});

describe("buildFileParts", () => {
	it("returns file part for images", () => {
		const parts = buildFileParts("/tmp/img.jpg", "image/jpeg", "img.jpg");
		expect(parts.length).toBe(1);
		expect(parts[0]?.type).toBe("file");
	});

	it("returns text part for non-images", () => {
		const parts = buildFileParts("/tmp/doc.pdf", "application/pdf", "doc.pdf");
		expect(parts.length).toBe(1);
		expect(parts[0]?.type).toBe("text");
		expect((parts[0] as { text: string }).text).toContain("doc.pdf");
	});
});

describe("validateFileForSend", () => {
	it("valid file", () => {
		expect(validateFileForSend(true, true, 1000, "/tmp/f")).toEqual({
			valid: true,
		});
	});

	it("file not found", () => {
		const r = validateFileForSend(false, false, 0, "/tmp/f");
		expect(r.valid).toBe(false);
		expect(r.error).toContain("not found");
	});

	it("not regular file", () => {
		const r = validateFileForSend(true, false, 0, "/tmp/f");
		expect(r.valid).toBe(false);
		expect(r.error).toContain("Not a regular file");
	});

	it("too large", () => {
		const r = validateFileForSend(true, true, 30 * 1024 * 1024, "/tmp/f");
		expect(r.valid).toBe(false);
		expect(r.error).toContain("too large");
	});
});

describe("selectSendMethod", () => {
	it("image/gif → sendAnimation", () => {
		expect(selectSendMethod("image/gif")).toBe("sendAnimation");
	});
	it("audio/ogg → sendVoice", () => {
		expect(selectSendMethod("audio/ogg")).toBe("sendVoice");
	});
	it("image/jpeg → sendPhoto", () => {
		expect(selectSendMethod("image/jpeg")).toBe("sendPhoto");
	});
	it("video/mp4 → sendVideo", () => {
		expect(selectSendMethod("video/mp4")).toBe("sendVideo");
	});
	it("audio/mpeg → sendAudio", () => {
		expect(selectSendMethod("audio/mpeg")).toBe("sendAudio");
	});
	it("application/pdf → sendDocument", () => {
		expect(selectSendMethod("application/pdf")).toBe("sendDocument");
	});
});
