import { convert } from "telegram-markdown-v2";
import { assert, expect, test, vi } from "vitest";
import { grammyFormatAgentList } from "~/lib/grammy-format-agent-list";

vi.mock("telegram-markdown-v2", { spy: true });

test("formats agent list message", () => {
  const agents = [
    { name: "assist", description: "General purpose" },
    { name: "build", description: "Software engineering" },
  ];
  const chunks = grammyFormatAgentList("build", agents as never);
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("Current agent:** `build`");
  expect(text).toContain("Available agents:");
  expect(text).toContain("- `assist`: General purpose");
  expect(text).toContain("- `build`: Software engineering");
  const chunk = chunks.at(0);
  assert.isDefined(chunk);
  assert.isDefined(chunk.markdown);
});

test("shows N/A for agents without description", () => {
  const agents = [{ name: "plan" }];
  const chunks = grammyFormatAgentList("plan", agents as never);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("- `plan`: N/A");
});

test("falls back to plain text when conversion fails", () => {
  vi.mocked(convert).mockImplementationOnce(() => {
    throw new Error("conversion failed");
  });
  const agents = [{ name: "build", description: "Software engineering" }];
  const chunks = grammyFormatAgentList("build", agents as never);
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks[0]?.markdown).toBeUndefined();
  expect(chunks[0]?.text).toContain("Current agent:** `build`");
});
