import { expect, test } from "vitest";
import { grammyFormatPermissionPrompt } from "~/lib/grammy-format-permission-prompt";

test("returns italic prompt text", () => {
  expect(grammyFormatPermissionPrompt()).toBe(
    "_How would you like to proceed?_",
  );
});
