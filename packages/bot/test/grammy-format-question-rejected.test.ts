import { expect, test } from "vitest";
import { grammyFormatQuestionRejected } from "~/lib/grammy-format-question-rejected";

test("returns dismissed text", () => {
  expect(grammyFormatQuestionRejected()).toBe("✕ Dismissed");
});
