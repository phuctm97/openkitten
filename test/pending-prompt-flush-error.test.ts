import { expect, test } from "vitest";
import { PendingPromptFlushError } from "~/lib/pending-prompt-flush-error";

test("formats message with singular session", () => {
  const error = new PendingPromptFlushError(1);
  expect(error.message).toBe("Pending prompt flush failed: 1 session");
  expect(error).toBeInstanceOf(Error);
});

test("formats message with plural sessions", () => {
  const error = new PendingPromptFlushError(3);
  expect(error.message).toBe("Pending prompt flush failed: 3 sessions");
  expect(error).toBeInstanceOf(Error);
});
