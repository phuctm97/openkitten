import { convert } from "telegram-markdown-v2";
import { assert, expect, test, vi } from "vitest";
import { grammyFormatAgentNotFound } from "~/lib/grammy-format-agent-not-found";

vi.mock("telegram-markdown-v2", { spy: true });

test("formats agent not found message", () => {
  const chunks = grammyFormatAgentNotFound("nonexistent");
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("❌");
  expect(text).toContain("There is no agent named `nonexistent`");
  expect(text).toContain("Use /agent without arguments");
  const chunk = chunks.at(0);
  assert.isDefined(chunk);
  assert.isDefined(chunk.markdown);
});

test("falls back to plain text when conversion fails", () => {
  vi.mocked(convert).mockImplementationOnce(() => {
    throw new Error("conversion failed");
  });
  const chunks = grammyFormatAgentNotFound("bad");
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks[0]?.markdown).toBeUndefined();
  expect(chunks[0]?.text).toContain("There is no agent named `bad`");
});
