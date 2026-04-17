import { expect, test } from "vitest";
import { getAttachmentKind } from "~/lib/get-attachment-kind";

test("prefers sticker and animation routing for matching mime or extension", () => {
  expect(getAttachmentKind("application/x-tgsticker", "file.bin")).toBe(
    "sticker",
  );
  expect(getAttachmentKind("application/octet-stream", "anim.gif")).toBe(
    "animation",
  );
});

test("keeps svg attachments as documents", () => {
  expect(getAttachmentKind("application/octet-stream", "vector.svg")).toBe(
    "document",
  );
});

test("routes image, video, and audio attachments by mime", () => {
  expect(getAttachmentKind("image/png", "photo.png")).toBe("photo");
  expect(getAttachmentKind("video/mp4", "clip.mp4")).toBe("video");
  expect(getAttachmentKind("audio/mpeg", "song.mp3")).toBe("audio");
});

test("falls back to documents for unknown attachments", () => {
  expect(getAttachmentKind("made/up", "blob")).toBe("document");
});
