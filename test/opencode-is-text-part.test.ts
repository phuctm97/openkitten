import type { Part } from "@opencode-ai/sdk/v2";
import { expect, test } from "vitest";
import { opencodeIsTextPart } from "~/lib/opencode-is-text-part";

test("opencodeIsTextPart returns true for text parts", () => {
  const part = { type: "text", text: "hello" } as Part;
  expect(opencodeIsTextPart(part)).toBe(true);
});

test("opencodeIsTextPart returns false for non-text parts", () => {
  const part = { type: "tool" } as Part;
  expect(opencodeIsTextPart(part)).toBe(false);
});
