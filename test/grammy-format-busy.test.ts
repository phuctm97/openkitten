import { expect, test } from "vitest";
import { grammyFormatBusy } from "~/lib/grammy-format-busy";

test("returns single chunk with busy message", () => {
  const chunks = grammyFormatBusy();
  expect(chunks).toHaveLength(1);
  const chunk = chunks.at(0);
  expect(chunk).toBeDefined();
  expect(chunk?.text).toBe(
    "> ⏳ The agent is busy.\n\n```tip\nYour message was not delivered. Wait for a response, then try again.\n```",
  );
});
