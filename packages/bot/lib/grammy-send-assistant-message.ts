import { grammyFormatAssistantMessage } from "~/lib/grammy-format-assistant-message";
import type { GrammySendAssistantMessageOptions } from "~/lib/grammy-send-assistant-message-options";
import { grammySendChunks } from "~/lib/grammy-send-chunks";

export async function grammySendAssistantMessage({
  info,
  parts,
  ...options
}: GrammySendAssistantMessageOptions): Promise<void> {
  const chunks = grammyFormatAssistantMessage(info, parts);
  await grammySendChunks({ ...options, chunks });
}
