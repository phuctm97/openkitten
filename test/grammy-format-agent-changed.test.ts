import { convert } from "telegram-markdown-v2";
import { assert, expect, test, vi } from "vitest";
import { grammyFormatAgentChanged } from "~/lib/grammy-format-agent-changed";

vi.mock("telegram-markdown-v2", { spy: true });

test("formats agent changed message", () => {
  const agent = { name: "build", description: "Software engineering" };
  const chunks = grammyFormatAgentChanged(agent as never);
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("🤖");
  expect(text).toContain("The agent is now `build`");
  expect(text).toContain("Software engineering");
  const chunk = chunks.at(0);
  assert.isDefined(chunk);
  assert.isDefined(chunk.markdown);
});

test("shows N/A when agent has no description", () => {
  const agent = { name: "plan" };
  const chunks = grammyFormatAgentChanged(agent as never);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("The agent is now `plan`");
  expect(text).toContain("N/A");
});

test("falls back to plain text when conversion fails", () => {
  vi.mocked(convert).mockImplementationOnce(() => {
    throw new Error("conversion failed");
  });
  const agent = { name: "build", description: "Software engineering" };
  const chunks = grammyFormatAgentChanged(agent as never);
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks[0]?.markdown).toBeUndefined();
  expect(chunks[0]?.text).toContain("The agent is now `build`");
});
