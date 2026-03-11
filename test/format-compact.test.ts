import { Effect } from "effect";
import { assert, expect, test, vi } from "vitest";
import { formatCompact } from "~/lib/format-compact";

vi.mock("telegram-markdown-v2", { spy: true });

test("produces message with compact emoji and tip", () => {
  const chunks = Effect.runSync(formatCompact());
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("🧹");
  expect(text).toContain("The session was compacted");
  expect(text).toContain("summarized to free up context");
  const chunk = chunks.at(0);
  assert.isDefined(chunk);
  assert.isDefined(chunk.markdown);
  expect(chunk.markdown).toContain("```info\n");
});
