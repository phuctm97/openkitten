import { expect, test } from "vitest";
import { getAttachmentName } from "~/lib/get-attachment-name";

test("keeps provided names with extensions", () => {
  expect(getAttachmentName("photo.png", "image/png", "attachment")).toBe(
    "photo.png",
  );
});

test("appends an inferred extension when the name is missing one", () => {
  expect(getAttachmentName("upload", "image/png", "attachment")).toBe(
    "upload.png",
  );
});

test("falls back to the fallback name when no name is provided", () => {
  expect(getAttachmentName(undefined, "application/pdf", "attachment")).toBe(
    "attachment.pdf",
  );
  expect(getAttachmentName(undefined, "made/up", "attachment")).toBe(
    "attachment",
  );
});
