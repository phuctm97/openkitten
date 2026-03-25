import { grammyFormatCompacted } from "~/lib/grammy-format-compacted";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendCompactedOptions } from "~/lib/grammy-send-compacted-options";

export async function grammySendCompacted({
  bot,
  chatId,
  threadId,
}: GrammySendCompactedOptions): Promise<void> {
  const chunks = grammyFormatCompacted();
  await grammySendChunks({ bot, chunks, chatId, threadId });
}
