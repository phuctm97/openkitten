import { expect, test, vi } from "vitest";
import * as grammyFormatQuestionMessageModule from "~/lib/grammy-format-question-message";
import * as grammySendChunksModule from "~/lib/grammy-send-chunks";
import { grammySendQuestionMessage } from "~/lib/grammy-send-question-message";

test("formats question message and sends chunks", async () => {
  const chunks = [{ text: "question" }];
  const question = {
    header: "Choose",
    question: "Pick one",
    options: [],
  };
  vi.spyOn(
    grammyFormatQuestionMessageModule,
    "grammyFormatQuestionMessage",
  ).mockReturnValue(chunks);
  vi.spyOn(grammySendChunksModule, "grammySendChunks").mockResolvedValue(
    undefined,
  );
  await grammySendQuestionMessage({
    bot: {} as never,
    question,
    chatId: 456,
    threadId: 789,
  });
  expect(
    grammyFormatQuestionMessageModule.grammyFormatQuestionMessage,
  ).toHaveBeenCalledWith(question);
  expect(grammySendChunksModule.grammySendChunks).toHaveBeenCalledWith({
    bot: {} as never,
    chunks,
    chatId: 456,
    threadId: 789,
  });
});
