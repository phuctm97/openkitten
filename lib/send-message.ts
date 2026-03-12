import { formatMessage } from "~/lib/format-message";
import { sendChunks } from "~/lib/send-chunks";
import type { SendMessageOptions } from "~/lib/send-message-options";

export async function sendMessage({
  bot,
  text,
  ignoreErrors,
  chatId,
  threadId,
}: SendMessageOptions): Promise<void> {
  const chunks = formatMessage(text);
  await sendChunks({ bot, chunks, ignoreErrors, chatId, threadId });
}
