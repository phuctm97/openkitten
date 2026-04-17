import { expect, test } from "vitest";
import { attachmentKindSchema } from "~/lib/attachment-kind-schema";

test("lists the supported Telegram attachment kinds", () => {
  expect(attachmentKindSchema.options).toEqual([
    "sticker",
    "animation",
    "document",
    "photo",
    "video",
    "audio",
  ]);
});

test("rejects unsupported attachment kinds", () => {
  expect(() => attachmentKindSchema.parse("unknown")).toThrow();
});
