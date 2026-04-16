import type { CommandContext, Context } from "grammy";
import { grammyCheckOwner } from "~/lib/grammy-check-owner";
import { grammySendOwnerOnly } from "~/lib/grammy-send-owner-only";
import type { Scope } from "~/lib/scope";

export async function grammyHandleAbort(
  scope: Scope,
  ctx: CommandContext<Context>,
  _signal: AbortSignal,
): Promise<void> {
  if (ctx.chat.type !== "private" && !grammyCheckOwner(ctx, scope.ownerId)) {
    await grammySendOwnerOnly({
      bot: scope.bot,
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
      replyToMessageId: ctx.msg.message_id,
    });
    return;
  }

  const { opencodeClient, existingSessions } = scope;
  const sessionId = await existingSessions.find(
    {
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
    },
    { createIfNotFound: true },
  );

  await Promise.all([
    opencodeClient.session.abort(
      { sessionID: sessionId },
      { throwOnError: true },
    ),
    ctx.react("👍"),
  ]);
}
