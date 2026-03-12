import { expect, test } from "vitest";
import { formatBusy } from "~/lib/format-busy";

test("formatBusy returns non-empty chunks", () => {
  const chunks = formatBusy();
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks[0].text).toContain("busy");
});
