import { expect, test } from "vitest";
import { grammyFormatPermissionPrompt } from "~/lib/grammy-format-permission-prompt";

test("returns how to proceed prompt", () => {
  const result = grammyFormatPermissionPrompt();
  expect(result).toContain("How would you like to proceed");
});
