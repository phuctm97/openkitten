import { grammyFormatQuestionMessage } from "~/lib/grammy-format-question-message";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendQuestionMessageOptions } from "~/lib/grammy-send-question-message-options";

export async function grammySendQuestionMessage({
  bot,
  question,
  chatId,
  threadId,
}: GrammySendQuestionMessageOptions): Promise<void> {
  const chunks = grammyFormatQuestionMessage(question);
  await grammySendChunks({ bot, chunks, chatId, threadId });
}
