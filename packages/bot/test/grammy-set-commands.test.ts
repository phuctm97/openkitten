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

test("registers provided commands with Telegram", async () => {
  const commands = [
    { command: "start", description: "Start a new conversation" },
    { command: "help", description: "Show help" },
  ];

  await grammySetCommands("test-token", commands);

  expect(mockSetMyCommands).toHaveBeenCalledOnce();
  expect(mockSetMyCommands).toHaveBeenCalledWith(commands);
});
