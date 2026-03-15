import { grammyFormatQuestionPending } from "~/lib/grammy-format-question-pending";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export async function grammySendQuestionPending({
  bot,
  chatId,
  threadId,
  ignoreErrors,
}: GrammySendOptions): Promise<void> {
  const chunks = grammyFormatQuestionPending();
  await grammySendChunks({ bot, chunks, chatId, threadId, ignoreErrors });
}
