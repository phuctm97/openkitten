import { Effect } from "effect";
import { assert, expect, test, vi } from "vitest";
import { formatStop } from "~/lib/format-stop";

vi.mock("telegram-markdown-v2", { spy: true });

test("produces message with stop emoji and session ID in code block", () => {
  const chunks = Effect.runSync(formatStop("sess-abc-123"));
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("🛑");
  expect(text).toContain("Stopped");
  expect(text).toContain("sess-abc-123");
  const chunk = chunks.at(0);
  assert.isDefined(chunk);
  assert.isDefined(chunk.markdown);
  expect(chunk.markdown).toContain("```Session\n");
});
