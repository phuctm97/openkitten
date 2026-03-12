import { consola } from "consola";
import type { Bot, Context } from "grammy";
import { grammySendError } from "~/lib/grammy-send-error";

export function grammyCreateHandler<C extends Context>(
  bot: Bot,
  callback: (ctx: C) => Promise<void>,
): (ctx: C) => void {
  return (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) throw new Error("grammy handler has no chat");
    const threadId = ctx.msg?.message_thread_id || undefined;
    callback(ctx).catch((error) => {
      consola.error("grammy handle error", { chatId, threadId }, error);
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
