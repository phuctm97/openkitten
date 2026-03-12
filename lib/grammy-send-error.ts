import { grammyFormatError } from "~/lib/grammy-format-error";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendErrorOptions } from "~/lib/grammy-send-error-options";

export async function grammySendError({
  bot,
  error,
  ignoreErrors,
  chatId,
  threadId,
}: GrammySendErrorOptions): Promise<void> {
  const chunks = grammyFormatError(error);
  await grammySendChunks({ bot, chunks, ignoreErrors, chatId, threadId });
}
