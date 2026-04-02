import type { AssistantMessage, Part } from "@opencode-ai/sdk/v2";
import { convert } from "telegram-markdown-v2";
import { assert, expect, test, vi } from "vitest";
import { grammyFormatAssistantMessage } from "~/lib/grammy-format-assistant-message";

vi.mock("telegram-markdown-v2", { spy: true });

function createInfo(): AssistantMessage {
  return {
    id: "m1",
    sessionID: "sess-1",
    role: "assistant",
    time: { created: 1, completed: 2 },
    parentID: "parent-1",
    modelID: "gpt-5",
    providerID: "openai",
    mode: "chat",
    agent: "default",
    path: { cwd: "/repo", root: "/repo" },
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
  };
}

function createTextPart(text: string): Part {
  return {
    id: `part-text-${text}`,
    sessionID: "sess-1",
    messageID: "m1",
    type: "text",
    text,
  };
}

function createToolPart(): Part {
  return {
    id: "part-tool-1",
    sessionID: "sess-1",
    messageID: "m1",
    type: "tool",
    callID: "call-1",
    tool: "bash",
    state: {
      status: "pending",
      input: {},
      raw: "echo hello",
    },
  };
}

test("formats text parts from an assistant message", () => {
  const chunks = grammyFormatAssistantMessage(createInfo(), [
    createTextPart("hello"),
    createToolPart(),
    createTextPart("world"),
  ]);
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((chunk) => chunk.text).join("\n");
  expect(text).toContain("hello");
  expect(text).toContain("world");
  expect(text).not.toContain("echo hello");
  assert.isDefined(chunks[0]?.markdown);
});

test("returns empty array when the assistant message has no text parts", () => {
  expect(
    grammyFormatAssistantMessage(createInfo(), [createToolPart()]),
  ).toEqual([]);
});

test("falls back to plain text when conversion fails", () => {
  vi.mocked(convert).mockImplementationOnce(() => {
    throw new Error("conversion failed");
  });
  const chunks = grammyFormatAssistantMessage(createInfo(), [
    createTextPart("hello world"),
  ]);
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks[0]?.markdown).toBeUndefined();
  expect(chunks[0]?.text).toContain("hello world");
});
