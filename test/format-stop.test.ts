import { Effect } from "effect";
import { assert, expect, test, vi } from "vitest";
import { formatStop } from "~/lib/format-stop";

vi.mock("telegram-markdown-v2", { spy: true });

test("produces message with stop emoji and tip", () => {
  const chunks = Effect.runSync(formatStop());
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("🛑");
  expect(text).toContain("The agent was stopped");
  expect(text).toContain("Send a new message");
  const chunk = chunks.at(0);
  assert.isDefined(chunk);
  assert.isDefined(chunk.markdown);
  expect(chunk.markdown).toContain("```Tip\n");
});
