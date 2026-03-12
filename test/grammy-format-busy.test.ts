import { expect, test } from "vitest";
import { grammyFormatBusy } from "~/lib/grammy-format-busy";

test("returns non-empty chunks", () => {
  const chunks = grammyFormatBusy();
  expect(chunks).not.toHaveLength(0);
  expect(chunks.some((c) => c.text.includes("busy"))).toBe(true);
});
