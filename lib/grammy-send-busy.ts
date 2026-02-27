import { grammyFormatBusy } from "~/lib/grammy-format-busy";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export async function grammySendBusy({
  bot,
  chatId,
  threadId,
}: GrammySendOptions): Promise<void> {
  const chunks = grammyFormatBusy();
  await grammySendChunks({ bot, chunks, chatId, threadId });
}
