import { describe, expect, test } from "bun:test";
import { buildFileParts, resolveFilename } from "~/lib/files";

describe("resolveFilename", () => {
	test("returns file.ext when no filename given", () => {
		expect(resolveFilename("image/jpeg")).toBe("file.jpg");
		expect(resolveFilename("application/pdf")).toBe("file.pdf");
		expect(resolveFilename("video/mp4")).toBe("file.mp4");
	});

	test("uses .bin for unknown MIME type", () => {
		expect(resolveFilename("application/x-unknown-type")).toBe("file.bin");
	});

	test("sanitizes dangerous characters from filename", () => {
		const result = resolveFilename("text/plain", "hello<world>.txt");
		expect(result).not.toContain("<");
		expect(result).not.toContain(">");
	});

	test("strips directory components (path traversal)", () => {
		const result = resolveFilename("text/plain", "../../etc/passwd");
		expect(result).not.toContain("/");
		expect(result).not.toContain("..");
		expect(result).toBe("passwd");
	});

	test("strips leading dots (hidden files)", () => {
		const result = resolveFilename("text/plain", ".hidden");
		expect(result).not.toMatch(/^\./);
	});

	test("collapses multiple underscores", () => {
		const result = resolveFilename("text/plain", "hello___world.txt");
		expect(result).not.toContain("___");
		expect(result).toContain("_");
	});

	test("collapses multiple spaces", () => {
		const result = resolveFilename("text/plain", "hello   world.txt");
		expect(result).not.toContain("   ");
	});

	test("preserves valid filenames", () => {
		expect(resolveFilename("text/plain", "report.txt")).toBe("report.txt");
		expect(resolveFilename("image/png", "photo.png")).toBe("photo.png");
	});

	test("returns file.ext for empty-ish names", () => {
		expect(resolveFilename("image/jpeg", "")).toBe("file.jpg");
		expect(resolveFilename("image/jpeg", ".jpg")).toBe("file.jpg");
	});

	test("handles MIME types with parameters", () => {
		expect(resolveFilename("text/plain; charset=utf-8")).toBe("file.txt");
	});

	test("preserves unicode characters in filenames", () => {
		const result = resolveFilename("text/plain", "документ.txt");
		expect(result).toBe("документ.txt");
	});
});

describe("buildFileParts", () => {
	test("returns file part for image MIME types", () => {
		const parts = buildFileParts("/tmp/photo.jpg", "image/jpeg", "photo.jpg");
		expect(parts).toHaveLength(1);
		expect(parts[0]).toEqual({
			type: "file",
			mime: "image/jpeg",
			filename: "photo.jpg",
			url: "file:///tmp/photo.jpg",
		});
	});

	test("returns file part for image/png", () => {
		const parts = buildFileParts("/tmp/img.png", "image/png", "img.png");
		expect(parts).toHaveLength(1);
		expect(parts[0]?.type).toBe("file");
	});

	test("returns file part for image/gif", () => {
		const parts = buildFileParts("/tmp/anim.gif", "image/gif", "anim.gif");
		expect(parts).toHaveLength(1);
		expect(parts[0]?.type).toBe("file");
	});

	test("returns text part for non-image types", () => {
		const parts = buildFileParts("/tmp/doc.pdf", "application/pdf", "doc.pdf");
		expect(parts).toHaveLength(1);
		expect(parts[0]?.type).toBe("text");
		expect((parts[0] as { text: string }).text).toContain("doc.pdf");
		expect((parts[0] as { text: string }).text).toContain("application/pdf");
		expect((parts[0] as { text: string }).text).toContain("/tmp/doc.pdf");
	});

	test("returns text part for video types", () => {
		const parts = buildFileParts("/tmp/vid.mp4", "video/mp4", "vid.mp4");
		expect(parts).toHaveLength(1);
		expect(parts[0]?.type).toBe("text");
	});

	test("returns text part for audio types", () => {
		const parts = buildFileParts("/tmp/song.mp3", "audio/mpeg", "song.mp3");
		expect(parts).toHaveLength(1);
		expect(parts[0]?.type).toBe("text");
	});

	test("handles MIME types with parameters", () => {
		const parts = buildFileParts(
			"/tmp/photo.jpg",
			"image/jpeg; charset=utf-8",
			"photo.jpg",
		);
		expect(parts).toHaveLength(1);
		expect(parts[0]?.type).toBe("file");
	});
});
