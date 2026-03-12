import { formatError } from "~/lib/format-error";
import { sendChunks } from "~/lib/send-chunks";
import type { SendErrorOptions } from "~/lib/send-error-options";

export async function sendError({
  bot,
  error,
  ignoreErrors,
  chatId,
  threadId,
}: SendErrorOptions): Promise<void> {
  const chunks = formatError(error);
  await sendChunks({ bot, chunks, ignoreErrors, chatId, threadId });
}
