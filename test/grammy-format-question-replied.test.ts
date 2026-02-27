import { expect, test } from "vitest";
import { grammyFormatQuestionReplied } from "~/lib/grammy-format-question-replied";

test("formats single answer", () => {
  expect(grammyFormatQuestionReplied(["Fast"])).toBe("✓ Fast");
});

test("formats multiple answers", () => {
  expect(grammyFormatQuestionReplied(["Fast", "Smart"])).toBe("✓ Fast, Smart");
});
