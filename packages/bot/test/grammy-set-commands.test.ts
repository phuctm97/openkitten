import { expect, test, vi } from "vitest";
import { grammySetCommands } from "~/lib/grammy-set-commands";

const { mockSetMyCommands } = vi.hoisted(() => {
  const mockSetMyCommands = vi.fn(async () => true);
  return { mockSetMyCommands };
});

vi.mock("grammy", () => ({
  Api: class MockApi {
    setMyCommands = mockSetMyCommands;
  },
}));

test("registers all bot commands with Telegram", async () => {
  await grammySetCommands("test-token");

  expect(mockSetMyCommands).toHaveBeenCalledOnce();
  expect(mockSetMyCommands).toHaveBeenCalledWith([
    { command: "start", description: "Start a new conversation" },
    { command: "abort", description: "Stop the current generation" },
    { command: "compact", description: "Summarize conversation history" },
    { command: "agent", description: "Switch or list AI agents" },
  ]);
});
