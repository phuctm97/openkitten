import type { Context, Filter } from "grammy";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

type TextContext = Filter<Context, "message:text">;

export async function grammyHandleText(
  {
    bot,
    opencodeClient,
    existingSessions,
    existingAgents,
    workingSessions,
    pendingPrompts,
  }: Scope,
  ctx: TextContext,
): Promise<void> {
  const sessionId = await existingSessions.find(
    {
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
    },
    { createIfNotFound: true },
  );

  // If the session has an active pending prompt, answer it.
  try {
    await pendingPrompts.answer({
      sessionId,
      messageId: ctx.message.message_id,
      text: ctx.message.text,
    });
    return;
  } catch (error) {
    if (!(error instanceof PendingPrompts.NotFoundError)) throw error;
  }

  // Otherwise, lock the session and send the message to OpenCode.
  try {
    await workingSessions.lock(sessionId, async () => {
      const agent = existingAgents.get(sessionId);
      await opencodeClient.session.promptAsync(
        {
          sessionID: sessionId,
          ...(agent && { agent }),
          parts: [{ type: "text", text: ctx.message.text }],
        },
        { throwOnError: true },
      );
    });
  } catch (error) {
    if (!(error instanceof WorkingSessions.LockedError)) throw error;
    await grammySendSessionPending({
      bot,
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
      replyToMessageId: ctx.message.message_id,
    });
  }
}
