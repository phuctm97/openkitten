import { expect, test, vi } from "vitest";
import * as grammyFormatQuestionPendingModule from "~/lib/grammy-format-question-pending";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";
import { grammySendQuestionPending } from "~/lib/grammy-send-question-pending";

test("formats question pending and sends chunks", async () => {
  const chunks = [{ text: "pending" }];
  vi.spyOn(
    grammyFormatQuestionPendingModule,
    "grammyFormatQuestionPending",
  ).mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendQuestionPending({
    bot: {} as never,
    chatId: 456,
    threadId: 789,
  });
  expect(
    grammyFormatQuestionPendingModule.grammyFormatQuestionPending,
  ).toHaveBeenCalled();
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
  });
});
