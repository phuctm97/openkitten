import type { Context, Filter } from "grammy";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyExtractReplyContext } from "~/lib/grammy-extract-reply-context";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

type TextContext = Filter<Context, "message:text">;

export async function grammyHandleText(
  scope: Scope,
  ctx: TextContext,
  _signal: AbortSignal,
): Promise<void> {
  const {
    bot,
    database,
    opencodeClient,
    existingSessions,
    workingSessions,
    pendingPrompts,
  } = scope;

  const replyContext = grammyExtractReplyContext(ctx);

  const sessionId = await existingSessions.find(
    {
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
    },
    { createIfNotFound: true },
  );

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

  try {
    await workingSessions.lock(sessionId, async () => {
      const agent = getSessionAgent(database, sessionId);
      await opencodeClient.session.promptAsync(
        {
          sessionID: sessionId,
          ...(agent && { agent }),
          parts: [
            {
              type: "text",
              text: replyContext
                ? `${replyContext}\n\n${ctx.message.text}`
                : ctx.message.text,
            },
          ],
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
