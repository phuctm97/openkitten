import { consola } from "consola";
import type { Context } from "grammy";
import { grammyCheckGoneError } from "~/lib/grammy-check-gone-error";
import type { GrammyHandleContext } from "~/lib/grammy-handle-context";
import { grammySendError } from "~/lib/grammy-send-error";

export function grammyCreateHandler<C extends Context>(
  grammyHandleContext: GrammyHandleContext,
  grammyHandleFn: (
    grammyHandleContext: GrammyHandleContext,
    grammyBotContext: C,
  ) => Promise<void>,
): (grammyBotContext: C) => void {
  return (grammyBotContext) => {
    const chatId = grammyBotContext.chat?.id;
    if (!chatId) {
      consola.fatal("grammY received a non-chat update", {
        updateId: grammyBotContext.update.update_id,
      });
      return;
    }
    const threadId = grammyBotContext.msg?.message_thread_id || undefined;
    const updateId = grammyBotContext.update.update_id;
    grammyHandleFn(grammyHandleContext, grammyBotContext).catch((error) => {
      consola.error("Failed to process update from Telegram", {
        error,
        chatId,
        threadId,
        updateId,
      });
      if (!grammyCheckGoneError(error)) {
        grammySendError({
          bot: grammyHandleContext.bot,
          error,
          chatId,
          threadId,
          ignoreErrors: true,
        });
      }
    });
  };
}
