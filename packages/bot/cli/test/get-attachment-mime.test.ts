import { expect, test } from "vitest";
import { getAttachmentMime } from "~/lib/get-attachment-mime";

test("returns normalized mime types when they are specific", () => {
  expect(getAttachmentMime(" Image/PNG; charset=utf-8 ", "file.bin")).toBe(
    "image/png",
  );
});

test("falls back to filename lookup for generic mime types", () => {
  expect(getAttachmentMime("application/octet-stream", "file.svg")).toBe(
    "image/svg+xml",
  );
});

test("returns the trimmed generic mime type when lookup fails", () => {
  expect(getAttachmentMime("application/octet-stream", "file")).toBe(
    "application/octet-stream",
  );
});
