import { grammyFormatQuestionPending } from "~/lib/grammy-format-question-pending";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export async function grammySendQuestionPending({
  bot,
  ignoreErrors,
  chatId,
  threadId,
}: GrammySendOptions): Promise<void> {
  const chunks = grammyFormatQuestionPending();
  await grammySendChunks({ bot, chunks, ignoreErrors, chatId, threadId });
}
