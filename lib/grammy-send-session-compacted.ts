import { grammyFormatSessionCompacted } from "~/lib/grammy-format-session-compacted";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export async function grammySendSessionCompacted({
  bot,
  chatId,
  threadId,
}: GrammySendOptions): Promise<void> {
  const chunks = grammyFormatSessionCompacted();
  await grammySendChunks({ bot, chunks, chatId, threadId });
}
