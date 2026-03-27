import type { CommandContext, Context } from "grammy";
import type { Scope } from "~/lib/scope";

export async function grammyHandleAbort(
  { opencodeClient, existingSessions }: Scope,
  ctx: CommandContext<Context>,
): Promise<void> {
  const sessionId = await existingSessions.findOrCreate({
    chatId: ctx.chat.id,
    threadId: ctx.msg.message_thread_id || undefined,
  });

  await Promise.all([
    opencodeClient.session.abort(
      { sessionID: sessionId },
      { throwOnError: true },
    ),
    ctx.react("👍"),
  ]);
}
