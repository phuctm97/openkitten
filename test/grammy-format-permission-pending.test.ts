import { expect, test } from "vitest";
import { grammyFormatPermissionPending } from "~/lib/grammy-format-permission-pending";

test("formats pending permission notification", () => {
  const chunks = grammyFormatPermissionPending();
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("A permission request needs your response.");
  expect(text).toContain("Respond to the pending permission request");
});
