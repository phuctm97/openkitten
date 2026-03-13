import { expect, test } from "vitest";
import { grammyFormatPermissionReplied } from "~/lib/grammy-format-permission-replied";

test("formats once reply", () => {
  expect(grammyFormatPermissionReplied("once")).toBe("✓ Allowed (once)");
});

test("formats always reply", () => {
  expect(grammyFormatPermissionReplied("always")).toBe("✓ Allowed (always)");
});

test("formats reject reply", () => {
  expect(grammyFormatPermissionReplied("reject")).toBe("✕ Denied");
});
