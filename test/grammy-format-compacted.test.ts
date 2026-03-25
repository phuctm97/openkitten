import { convert } from "telegram-markdown-v2";
import { assert, expect, test, vi } from "vitest";
import { grammyFormatCompacted } from "~/lib/grammy-format-compacted";

vi.mock("telegram-markdown-v2", { spy: true });

test("formats compacted message", () => {
  const chunks = grammyFormatCompacted();
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("🧹");
  expect(text).toContain("The session was compacted");
  expect(text).toContain("conversation history was summarized");
  const chunk = chunks.at(0);
  assert.isDefined(chunk);
  assert.isDefined(chunk.markdown);
});

test("falls back to plain text when conversion fails", () => {
  vi.mocked(convert).mockImplementationOnce(() => {
    throw new Error("conversion failed");
  });
  const chunks = grammyFormatCompacted();
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks[0]?.markdown).toBeUndefined();
  expect(chunks[0]?.text).toContain("The session was compacted");
});
