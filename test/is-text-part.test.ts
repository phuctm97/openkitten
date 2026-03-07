import type { Part } from "@opencode-ai/sdk/v2";
import { expect, test } from "vitest";
import { isTextPart } from "~/lib/is-text-part";

const textPart: Part = {
  id: "1",
  sessionID: "s1",
  messageID: "m1",
  type: "text",
  text: "hello",
};

const subtaskPart: Part = {
  id: "2",
  sessionID: "s1",
  messageID: "m1",
  type: "subtask",
  prompt: "do something",
  description: "a subtask",
  agent: "default",
};

test("returns true for text parts", () => {
  expect(isTextPart(textPart)).toBe(true);
});

test("returns false for non-text parts", () => {
  expect(isTextPart(subtaskPart)).toBe(false);
});
