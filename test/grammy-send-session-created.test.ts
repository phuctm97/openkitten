import { expect, test, vi } from "vitest";
import * as grammyFormatSessionCreatedModule from "~/lib/grammy-format-session-created";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";
import { grammySendSessionCreated } from "~/lib/grammy-send-session-created";

test("formats session created and sends chunks", async () => {
  const chunks = [{ text: "created" }];
  vi.spyOn(
    grammyFormatSessionCreatedModule,
    "grammyFormatSessionCreated",
  ).mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendSessionCreated({
    bot: {} as never,
    sessionId: "sess_abc123",
    chatId: 456,
    threadId: 789,
    replyToMessageId: 101,
  });
  expect(
    grammyFormatSessionCreatedModule.grammyFormatSessionCreated,
  ).toHaveBeenCalledWith("sess_abc123");
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
    replyToMessageId: 101,
  });
});
