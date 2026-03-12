import { formatBusy } from "~/lib/format-busy";
import { sendChunks } from "~/lib/send-chunks";
import type { SendOptions } from "~/lib/send-options";

export async function sendBusy({
  client,
  ignoreErrors,
  chatId,
  threadId,
}: SendOptions): Promise<void> {
  const chunks = formatBusy();
  await sendChunks({ client, chunks, ignoreErrors, chatId, threadId });
}
