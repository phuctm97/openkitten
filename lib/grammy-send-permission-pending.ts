import { grammyFormatPermissionPending } from "~/lib/grammy-format-permission-pending";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export async function grammySendPermissionPending({
  bot,
  ignoreErrors,
  chatId,
  threadId,
}: GrammySendOptions): Promise<void> {
  const chunks = grammyFormatPermissionPending();
  await grammySendChunks({ bot, chunks, ignoreErrors, chatId, threadId });
}
