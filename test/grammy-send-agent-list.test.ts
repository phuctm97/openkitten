import { expect, test, vi } from "vitest";
import * as grammyFormatAgentListModule from "~/lib/grammy-format-agent-list";
import { grammySendAgentList } from "~/lib/grammy-send-agent-list";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";

test("formats agent list and sends chunks", async () => {
  const chunks = [{ text: "list" }];
  const agents = [{ name: "build" }];
  vi.spyOn(
    grammyFormatAgentListModule,
    "grammyFormatAgentList",
  ).mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendAgentList({
    bot: {} as never,
    currentAgent: "build",
    availableAgents: agents as never,
    chatId: 456,
    threadId: 789,
  });
  expect(
    grammyFormatAgentListModule.grammyFormatAgentList,
  ).toHaveBeenCalledWith("build", agents);
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
  });
});
