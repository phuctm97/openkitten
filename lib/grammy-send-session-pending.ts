import { grammyFormatSessionPending } from "~/lib/grammy-format-session-pending";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export async function grammySendSessionPending({
  bot,
  chatId,
  threadId,
}: GrammySendOptions): Promise<void> {
  const chunks = grammyFormatSessionPending();
  await grammySendChunks({ bot, chunks, chatId, threadId });
}
