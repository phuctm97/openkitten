import { grammyFormatMessage } from "~/lib/grammy-format-message";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendMessageOptions } from "~/lib/grammy-send-message-options";

export async function grammySendMessage({
  bot,
  text,
  ignoreErrors,
  chatId,
  threadId,
}: GrammySendMessageOptions): Promise<void> {
  const chunks = grammyFormatMessage(text);
  await grammySendChunks({ bot, chunks, ignoreErrors, chatId, threadId });
}
