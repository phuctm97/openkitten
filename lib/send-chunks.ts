import { consola } from "consola";
import type { SendChunksOptions } from "~/lib/send-chunks-options";

export async function sendChunks({
  bot,
  chunks,
  ignoreErrors,
  chatId,
  threadId,
}: SendChunksOptions): Promise<void> {
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
          consola.debug(
            "failed to send MarkdownV2 message, falling back to plain text",
            { error, markdown, text },
          );
          await bot.api.sendMessage(chatId, text, sendOpts);
        }
      } else {
        await bot.api.sendMessage(chatId, text, sendOpts);
      }
    }
  } catch (error) {
    if (ignoreErrors) {
      consola.error(error);
    } else {
      throw error;
    }
  }
}
