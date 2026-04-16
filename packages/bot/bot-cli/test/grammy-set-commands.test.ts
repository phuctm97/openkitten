import { beforeEach, expect, test, vi } from "vitest";
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

beforeEach(() => {
  mockSetMyCommands.mockClear();
});

test("registers provided commands with Telegram when groupChat is off", async () => {
  const commands = [
    { command: "start", description: "Start a new conversation" },
    { command: "help", description: "Show help" },
  ];

  await grammySetCommands("test-token", commands);

  expect(mockSetMyCommands).toHaveBeenCalledOnce();
  expect(mockSetMyCommands).toHaveBeenCalledWith(commands);
});

test("registers scoped commands when groupChat is on", async () => {
  const commands = [
    { command: "start", description: "Start a new conversation" },
    { command: "help", description: "Show help" },
  ];

  await grammySetCommands("test-token", commands, true);

  expect(mockSetMyCommands).toHaveBeenCalledTimes(2);
  expect(mockSetMyCommands).toHaveBeenCalledWith(commands, {
    scope: { type: "all_private_chats" },
  });
  expect(mockSetMyCommands).toHaveBeenCalledWith(
    [
      {
        command: "start",
        description: "Start a new conversation (owner only)",
      },
      { command: "help", description: "Show help" },
    ],
    { scope: { type: "all_group_chats" } },
  );
});
