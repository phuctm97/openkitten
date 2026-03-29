import { grammyFormatQuestionMessage } from "~/lib/grammy-format-question-message";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendQuestionMessageOptions } from "~/lib/grammy-send-question-message-options";

export async function grammySendQuestionMessage({
  question,
  ...options
}: GrammySendQuestionMessageOptions): Promise<void> {
  const chunks = grammyFormatQuestionMessage(question);
  await grammySendChunks({ ...options, chunks });
}
