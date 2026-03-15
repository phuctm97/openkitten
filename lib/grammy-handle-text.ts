import type { Context, Filter } from "grammy";
import { findOrCreateSession } from "~/lib/find-or-create-session";
import type { GrammyHandleContext } from "~/lib/grammy-handle-context";
import { grammySendBusy } from "~/lib/grammy-send-busy";
import { PendingPromptNotFoundError } from "~/lib/pending-prompt-not-found-error";

type TextContext = Filter<Context, "message:text">;

export async function grammyHandleText(
  {
    bot,
    database,
    opencodeClient,
    workingSessions,
    pendingPrompts,
  }: GrammyHandleContext,
  ctx: TextContext,
): Promise<void> {
  const { sessionId } = await findOrCreateSession(
    database,
    opencodeClient,
    ctx.chat.id,
    ctx.msg.message_thread_id || undefined,
  );

  // If there's an active pending prompt for this session, answer it.
  try {
    await pendingPrompts.answer({
      sessionId,
      text: ctx.message.text,
    });
    return;
  } catch (error) {
    if (!(error instanceof PendingPromptNotFoundError)) throw error;
  }

  // Check if the session is working.
  if (workingSessions.check(sessionId)) {
    await grammySendBusy({
      bot,
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
      ignoreErrors: false,
    });
    return;
  }

  // Send the message to OpenCode.
  await opencodeClient.session.promptAsync(
    {
      sessionID: sessionId,
      parts: [{ type: "text", text: ctx.message.text }],
    },
    { throwOnError: true },
  );
}
