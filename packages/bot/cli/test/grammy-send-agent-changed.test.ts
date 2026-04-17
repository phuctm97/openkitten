import { expect, test, vi } from "vitest";
import * as grammyFormatAgentChangedModule from "~/lib/grammy-format-agent-changed";
import { grammySendAgentChanged } from "~/lib/grammy-send-agent-changed";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";

test("formats agent changed and sends chunks", async () => {
  const chunks = [{ text: "changed" }];
  const agent = { name: "build" };
  vi.spyOn(
    grammyFormatAgentChangedModule,
    "grammyFormatAgentChanged",
  ).mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendAgentChanged({
    bot: {} as never,
    agent: agent as never,
    chatId: 456,
    threadId: 789,
    replyToMessageId: 101,
  });
  expect(
    grammyFormatAgentChangedModule.grammyFormatAgentChanged,
  ).toHaveBeenCalledWith(agent);
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
    replyToMessageId: 101,
  });
});
