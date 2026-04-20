import { beforeEach, expect, test, vi } from "vitest";
import { grammySetCommands } from "~/lib/grammy-set-commands";

const { mockSetMyCommands, mockDeleteMyCommands } = vi.hoisted(() => {
  const mockSetMyCommands = vi.fn(async () => true);
  const mockDeleteMyCommands = vi.fn(async () => true);
  return { mockSetMyCommands, mockDeleteMyCommands };
});

vi.mock("grammy", () => ({
  Api: class MockApi {
    setMyCommands = mockSetMyCommands;
    deleteMyCommands = mockDeleteMyCommands;
  },
}));

beforeEach(() => {
  mockSetMyCommands.mockClear();
  mockDeleteMyCommands.mockClear();
});

test("clears override scopes and registers commands with Telegram", async () => {
  const commands = [
    { command: "start", description: "Start a new conversation" },
    { command: "help", description: "Show help" },
  ];

  await grammySetCommands("test-token", commands);

  expect(mockDeleteMyCommands).toHaveBeenCalledWith({
    scope: { type: "all_private_chats" },
  });
  expect(mockDeleteMyCommands).toHaveBeenCalledWith({
    scope: { type: "all_group_chats" },
  });
  expect(mockDeleteMyCommands).toHaveBeenCalledWith({
    scope: { type: "all_chat_administrators" },
  });
  expect(mockSetMyCommands).toHaveBeenCalledOnce();
  expect(mockSetMyCommands).toHaveBeenCalledWith(commands);
});
