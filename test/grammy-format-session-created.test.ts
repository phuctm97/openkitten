import { convert } from "telegram-markdown-v2";
import { assert, expect, test, vi } from "vitest";
import { grammyFormatSessionCreated } from "~/lib/grammy-format-session-created";

vi.mock("telegram-markdown-v2", { spy: true });

test("formats session created message with session ID", () => {
  const chunks = grammyFormatSessionCreated("sess_abc123");
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("🆕");
  expect(text).toContain("A new session just started");
  expect(text).toContain("sess_abc123");
  const chunk = chunks.at(0);
  assert.isDefined(chunk);
  assert.isDefined(chunk.markdown);
});

test("falls back to plain text when conversion fails", () => {
  vi.mocked(convert).mockImplementationOnce(() => {
    throw new Error("conversion failed");
  });
  const chunks = grammyFormatSessionCreated("sess_abc123");
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks[0]?.markdown).toBeUndefined();
  expect(chunks[0]?.text).toContain("A new session just started");
});
