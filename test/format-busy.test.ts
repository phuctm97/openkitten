import { expect, test } from "vitest";
import { formatBusy } from "~/lib/format-busy";

test("returns chunks with busy message", () => {
  const chunks = formatBusy();
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("\u23F3");
  expect(text).toContain("agent is busy");
});
