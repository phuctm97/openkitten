import { beforeEach, expect, test, vi } from "vitest";
import { grammyResetCommands } from "~/lib/grammy-reset-commands";

const { mockSetMyCommands, mockDeleteMyCommands } = vi.hoisted(() => ({
  mockSetMyCommands: vi.fn(async () => true),
  mockDeleteMyCommands: vi.fn(async () => true),
}));

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

test("clears override scopes then sets default-scope commands", async () => {
  const commands = [
    { command: "start", description: "Start a new conversation" },
    { command: "help", description: "Show help" },
  ];

  await grammyResetCommands("test-token", commands);

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
