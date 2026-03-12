import { consola } from "consola";
import type { SendChunksOptions } from "~/lib/send-chunks-options";

/** Sends chunks to Telegram, falling back to plain text if MarkdownV2 fails. */
export async function sendChunks({
  client,
  chunks,
  ignoreErrors,
  chatId,
  threadId,
}: SendChunksOptions): Promise<void> {
  const sendOpts = {
    ...(threadId && { message_thread_id: threadId }),
  };

  for (const { markdown, text } of chunks) {
    try {
      if (markdown) {
        try {
          await client.api.sendMessage(chatId, markdown, {
            parse_mode: "MarkdownV2",
            ...sendOpts,
          });
        } catch (error) {
          consola.debug(
            "failed to send MarkdownV2 message, falling back to plain text",
            { error, markdown, text },
          );
          await client.api.sendMessage(chatId, text, sendOpts);
        }
      } else {
        await client.api.sendMessage(chatId, text, sendOpts);
      }
    } catch (error) {
      if (ignoreErrors) {
        consola.error(error);
      } else {
        throw error;
      }
    }
  }
}
