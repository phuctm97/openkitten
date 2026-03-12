import { formatBusy } from "~/lib/format-busy";
import { sendChunks } from "~/lib/send-chunks";
import type { SendOptions } from "~/lib/send-options";

export async function sendBusy({
  bot,
  ignoreErrors,
  chatId,
  threadId,
}: SendOptions): Promise<void> {
  const chunks = formatBusy();
  await sendChunks({ bot, chunks, ignoreErrors, chatId, threadId });
}
