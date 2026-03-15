import { expect, test } from "vitest";
import { grammyFormatPermissionPending } from "~/lib/grammy-format-permission-pending";

test("returns single chunk with permission pending message", () => {
  const chunks = grammyFormatPermissionPending();
  expect(chunks).toHaveLength(1);
  const chunk = chunks.at(0);
  expect(chunk).toBeDefined();
  expect(chunk?.text).toBe(
    "> ❗ A permission request needs your response.\n\n```tip\nRespond to the pending permission request before sending a new message.\n```",
  );
});
