import { consola } from "consola";
import type { GrammySendChunksOptions } from "~/lib/grammy-send-chunks-options";

export async function grammySendChunks({
  bot,
  chunks,
  ignoreErrors,
  chatId,
  threadId,
}: GrammySendChunksOptions): Promise<void> {
  const sendOpts = {
    ...(threadId && { message_thread_id: threadId }),
  };

  try {
    for (const { markdown, text } of chunks) {
      if (markdown) {
        try {
          await bot.api.sendMessage(chatId, markdown, {
            parse_mode: "MarkdownV2",
            ...sendOpts,
          });
        } catch (error) {
          consola.debug("Failed to send MarkdownV2, falling back to raw text", {
            error,
            text,
            markdown,
            chatId,
            threadId,
          });
          await bot.api.sendMessage(chatId, text, sendOpts);
        }
      } else {
        await bot.api.sendMessage(chatId, text, sendOpts);
      }
    }
  } catch (error) {
    if (ignoreErrors) {
      consola.error("Failed to send message to Telegram", {
        error,
        chunks,
        chatId,
        threadId,
      });
    } else {
      throw error;
    }
  }
}
