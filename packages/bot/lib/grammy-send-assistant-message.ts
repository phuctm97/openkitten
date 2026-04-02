import { grammyFormatAssistantMessage } from "~/lib/grammy-format-assistant-message";
import type { GrammySendAssistantMessageOptions } from "~/lib/grammy-send-assistant-message-options";
import { grammySendChunks } from "~/lib/grammy-send-chunks";

export async function grammySendAssistantMessage({
  message,
  ...options
}: GrammySendAssistantMessageOptions): Promise<void> {
  const chunks = grammyFormatAssistantMessage(message);
  await grammySendChunks({ ...options, chunks });
}
