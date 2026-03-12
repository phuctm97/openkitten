import { expect, test } from "vitest";
import { formatBusy } from "~/lib/format-busy";

test("formatBusy returns non-empty chunks", () => {
  const chunks = formatBusy();
  expect(chunks).not.toHaveLength(0);
  expect(chunks.some((c) => c.text.includes("busy"))).toBe(true);
});
