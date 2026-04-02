import { expect, test, vi } from "vitest";
import * as grammyFormatAssistantMessageModule from "~/lib/grammy-format-assistant-message";
import { grammySendAssistantMessage } from "~/lib/grammy-send-assistant-message";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";

const message = {
  info: {
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
  },
  parts: [{ type: "text", text: "hello" }],
} as never;

test("formats assistant message and sends chunks", async () => {
  const bot = {} as never;
  const chunks = [{ text: "hello" }];
  vi.spyOn(
    grammyFormatAssistantMessageModule,
    "grammyFormatAssistantMessage",
  ).mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendAssistantMessage({
    bot,
    message,
    chatId: 123,
    threadId: 456,
    replyToMessageId: 101,
  });
  expect(
    grammyFormatAssistantMessageModule.grammyFormatAssistantMessage,
  ).toHaveBeenCalledWith(message);
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot,
    chunks,
    chatId: 123,
    threadId: 456,
    replyToMessageId: 101,
  });
});

test("passes empty assistant messages to the shared chunk sender", async () => {
  const bot = {} as never;
  vi.spyOn(
    grammyFormatAssistantMessageModule,
    "grammyFormatAssistantMessage",
  ).mockReturnValue([]);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendAssistantMessage({
    bot,
    message,
    chatId: 123,
    threadId: 456,
  });
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot,
    chunks: [],
    chatId: 123,
    threadId: 456,
  });
});
