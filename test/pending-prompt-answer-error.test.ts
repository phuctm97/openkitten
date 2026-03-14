import { expect, test } from "vitest";
import { PendingPromptAnswerError } from "~/lib/pending-prompt-answer-error";

test("stores code and formats message", () => {
  const error = new PendingPromptAnswerError("expired_session");
  expect(error.code).toBe("expired_session");
  expect(error.message).toBe("pending prompt answer error: expired_session");
  expect(error).toBeInstanceOf(Error);
});
