import type { CommandContext, Context } from "grammy";
import type { Scope } from "~/lib/scope";

export async function grammyHandleAbort(
  { opencodeClient, existingSessions }: Scope,
  ctx: CommandContext<Context>,
): Promise<void> {
  const sessionId = existingSessions.find({
    chatId: ctx.chat.id,
    threadId: ctx.msg.message_thread_id || undefined,
  });
  if (!sessionId) return;

  await opencodeClient.session.abort({ sessionID: sessionId });
}
