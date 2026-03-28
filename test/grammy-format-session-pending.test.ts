import { expect, test } from "vitest";
import { grammyFormatSessionPending } from "~/lib/grammy-format-session-pending";

test("returns single chunk with session pending message", () => {
  const chunks = grammyFormatSessionPending();
  expect(chunks).toHaveLength(1);
  const chunk = chunks.at(0);
  expect(chunk).toBeDefined();
  expect(chunk?.text).toBe(
    "> ⏳ A session response is pending.\n\n```tip\nWait for the current session response before sending a new message.\n```",
  );
});
