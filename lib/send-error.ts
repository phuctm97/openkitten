import { formatError } from "~/lib/format-error";
import { sendChunks } from "~/lib/send-chunks";
import type { SendErrorOptions } from "~/lib/send-error-options";

export async function sendError({
  client,
  error,
  ignoreErrors,
  chatId,
  threadId,
}: SendErrorOptions): Promise<void> {
  const chunks = formatError(error);
  await sendChunks({ client, chunks, ignoreErrors, chatId, threadId });
}
