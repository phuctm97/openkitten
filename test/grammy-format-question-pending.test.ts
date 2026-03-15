import { expect, test } from "vitest";
import { grammyFormatQuestionPending } from "~/lib/grammy-format-question-pending";

test("returns single chunk with question pending message", () => {
  const chunks = grammyFormatQuestionPending();
  expect(chunks).toHaveLength(1);
  const chunk = chunks.at(0);
  expect(chunk).toBeDefined();
  expect(chunk?.text).toBe(
    "> ❓ A question needs your answer.\n\n```tip\nAnswer the pending question before sending a new message.\n```",
  );
});
