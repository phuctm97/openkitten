import type { Part } from "@opencode-ai/sdk/v2";
import { expect, test } from "vitest";
import { opencodeCheckTextPart } from "~/lib/opencode-check-text-part";

test("opencodeCheckTextPart returns true for text parts", () => {
  const part = { type: "text", text: "hello" } as Part;
  expect(opencodeCheckTextPart(part)).toBe(true);
});

test("opencodeCheckTextPart returns false for non-text parts", () => {
  const part = { type: "tool" } as Part;
  expect(opencodeCheckTextPart(part)).toBe(false);
});
