import type { Context, Filter } from "grammy";
import invariant from "tiny-invariant";
import type { Scope } from "~/lib/scope";

type CallbackContext = Filter<Context, "callback_query:data">;

export async function grammyHandleCallback(
  { bot, existingSessions, pendingPrompts }: Scope,
  ctx: CallbackContext,
): Promise<void> {
  const message = ctx.callbackQuery.message;
  invariant(message, "Expected callback query to have a message");

  const sessionId = existingSessions.find(
    message.chat.id,
    message.message_thread_id || undefined,
  );
  if (!sessionId) {
    await bot.api.answerCallbackQuery(ctx.callbackQuery.id, {
      text: "An error occurred: expired_session",
    });
    return;
  }

  await pendingPrompts.answer({
    sessionId,
    callbackQueryId: ctx.callbackQuery.id,
    callbackQueryData: ctx.callbackQuery.data,
  });
}
