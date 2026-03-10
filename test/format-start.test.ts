import { Effect } from "effect";
import { assert, expect, test, vi } from "vitest";
import { formatStart } from "~/lib/format-start";

vi.mock("telegram-markdown-v2", { spy: true });

test("new session produces 'New session created' with session ID", () => {
  const chunks = Effect.runSync(formatStart("sess-abc-123", true));
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("✨");
  expect(text).toContain("New session created");
  expect(text).toContain("sess-abc-123");
  const chunk = chunks.at(0);
  assert.isDefined(chunk);
  assert.isDefined(chunk.markdown);
  expect(chunk.markdown).toContain("```Session\n");
});

test("existing session produces 'Existing session resumed' with session ID", () => {
  const chunks = Effect.runSync(formatStart("sess-xyz-789", false));
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("👋");
  expect(text).toContain("Existing session resumed");
  expect(text).toContain("sess-xyz-789");
  const chunk = chunks.at(0);
  assert.isDefined(chunk);
  assert.isDefined(chunk.markdown);
  expect(chunk.markdown).toContain("```Session\n");
});
