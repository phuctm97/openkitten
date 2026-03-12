import type { Part } from "@opencode-ai/sdk/v2";
import { expect, test } from "vitest";
import { isTextPart } from "~/lib/is-text-part";

test("isTextPart returns true for text parts", () => {
  const part = { type: "text", text: "hello" } as Part;
  expect(isTextPart(part)).toBe(true);
});

test("isTextPart returns false for non-text parts", () => {
  const part = { type: "tool" } as Part;
  expect(isTextPart(part)).toBe(false);
});
