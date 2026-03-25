import { grammyFormatCompact } from "~/lib/grammy-format-compact";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendCompactOptions } from "~/lib/grammy-send-compact-options";

export async function grammySendCompact({
  bot,
  chatId,
  threadId,
}: GrammySendCompactOptions): Promise<void> {
  const chunks = grammyFormatCompact();
  await grammySendChunks({ bot, chunks, chatId, threadId });
}
