import { consola } from "consola";
import type { Context } from "grammy";
import { grammyCheckGoneError } from "~/lib/grammy-check-gone-error";
import type { GrammyHandleContext } from "~/lib/grammy-handle-context";
import { grammySendError } from "~/lib/grammy-send-error";

export function grammyCreateHandler<C extends Context>(
  context: GrammyHandleContext,
  callback: (context: GrammyHandleContext, ctx: C) => Promise<void>,
): (ctx: C) => void {
  return (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      consola.fatal("grammY received a non-chat update", {
        updateId: ctx.update.update_id,
      });
      return;
    }
    const threadId = ctx.msg?.message_thread_id || undefined;
    const updateId = ctx.update.update_id;
    callback(context, ctx).catch((error) => {
      consola.error("Failed to process update from Telegram", {
        error,
        chatId,
        threadId,
        updateId,
      });
      if (!grammyCheckGoneError(error)) {
        grammySendError({
          bot: context.bot,
          error,
          chatId,
          threadId,
          ignoreErrors: true,
        });
      }
    });
  };
}
