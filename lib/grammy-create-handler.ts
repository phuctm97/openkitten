import { consola } from "consola";
import type { Bot, Context } from "grammy";
import { grammySendError } from "~/lib/grammy-send-error";

export function grammyCreateHandler<C extends Context>(
  bot: Bot,
  callback: (ctx: C) => Promise<void>,
): (ctx: C) => void {
  return (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      consola.fatal("grammY received an update without a chat", {
        updateId: ctx.update.update_id,
      });
      return;
    }
    const threadId = ctx.msg?.message_thread_id || undefined;
    const updateId = ctx.update.update_id;
    callback(ctx).catch((error) => {
      consola.error("Failed to process update from Telegram", {
        error,
        chatId,
        threadId,
        updateId,
      });
      grammySendError({
        bot,
        error,
        chatId,
        threadId,
        ignoreErrors: true,
      });
    });
  };
}
