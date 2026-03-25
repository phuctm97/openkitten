import { grammyFormatCompacted } from "~/lib/grammy-format-compacted";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export async function grammySendCompacted({
  bot,
  chatId,
  threadId,
}: GrammySendOptions): Promise<void> {
  const chunks = grammyFormatCompacted();
  await grammySendChunks({ bot, chunks, chatId, threadId });
}
