import { expect, test } from "vitest";
import { grammyFormatQuestionPending } from "~/lib/grammy-format-question-pending";

test("returns non-empty chunks", () => {
  const chunks = grammyFormatQuestionPending();
  expect(chunks).not.toHaveLength(0);
  expect(chunks.some((c) => c.text.includes("question"))).toBe(true);
});
