import type { CommandContext, Context } from "grammy";
import { grammyCheckOwner } from "~/lib/grammy-check-owner";
import { grammySendOwnerOnly } from "~/lib/grammy-send-owner-only";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

export async function grammyHandleCompact(
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

  const { bot, opencodeClient, existingSessions, workingSessions } = scope;
  const sessionId = await existingSessions.find(
    {
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
    },
    { createIfNotFound: true },
  );

  try {
    await workingSessions.lock(sessionId, async () => {
      await Promise.all([
        opencodeClient.session.summarize(
          { sessionID: sessionId },
          { throwOnError: true },
        ),
        ctx.react("👍"),
      ]);
    });
  } catch (error) {
    if (!(error instanceof WorkingSessions.LockedError)) throw error;
    await grammySendSessionPending({
      bot,
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
      replyToMessageId: ctx.msg.message_id,
    });
  }
}
