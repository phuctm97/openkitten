import type { GrammySendChunksOptions } from "~/lib/grammy-send-chunks-options";
import { logger } from "~/lib/logger";

export async function grammySendChunks({
  bot,
  chunks,
  chatId,
  threadId,
  replyToMessageId,
}: GrammySendChunksOptions): Promise<void> {
  for (const [index, { markdown, text }] of chunks.entries()) {
    const sendOpts = {
      link_preview_options: { is_disabled: true } as const,
      ...(threadId && { message_thread_id: threadId }),
      ...(index === 0 &&
        replyToMessageId && {
          reply_parameters: { message_id: replyToMessageId },
        }),
    };

    if (markdown) {
      try {
        await bot.api.sendMessage(chatId, markdown, {
          parse_mode: "MarkdownV2",
          ...sendOpts,
        });
      } catch (error) {
        logger.warn("Failed to send MarkdownV2, falling back to text", error, {
          markdown,
          text,
          chatId,
          threadId,
        });
        await bot.api.sendMessage(chatId, text, sendOpts);
      }
    } else {
      await bot.api.sendMessage(chatId, text, sendOpts);
    }
  }
}
