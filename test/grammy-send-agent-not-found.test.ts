import { expect, test, vi } from "vitest";
import * as grammyFormatAgentNotFoundModule from "~/lib/grammy-format-agent-not-found";
import { grammySendAgentNotFound } from "~/lib/grammy-send-agent-not-found";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";

test("formats agent not found and sends chunks", async () => {
  const chunks = [{ text: "not found" }];
  vi.spyOn(
    grammyFormatAgentNotFoundModule,
    "grammyFormatAgentNotFound",
  ).mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendAgentNotFound({
    bot: {} as never,
    name: "nonexistent",
    chatId: 456,
    threadId: 789,
    replyToMessageId: 101,
  });
  expect(
    grammyFormatAgentNotFoundModule.grammyFormatAgentNotFound,
  ).toHaveBeenCalledWith("nonexistent");
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
    replyToMessageId: 101,
  });
});
