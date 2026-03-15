import { grammyFormatPermissionMessage } from "~/lib/grammy-format-permission-message";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { GrammySendPermissionMessageOptions } from "~/lib/grammy-send-permission-message-options";

export async function grammySendPermissionMessage({
  bot,
  request,
  chatId,
  threadId,
  ignoreErrors,
}: GrammySendPermissionMessageOptions): Promise<void> {
  const chunks = grammyFormatPermissionMessage(request);
  await grammySendChunks({ bot, chunks, chatId, threadId, ignoreErrors });
}
