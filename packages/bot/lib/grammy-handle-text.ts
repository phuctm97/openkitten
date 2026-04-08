import type { Context, Filter } from "grammy";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyHandleCustomCommand } from "~/lib/grammy-handle-custom-command";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

type TextContext = Filter<Context, "message:text">;

const commandPattern =
  /^\/([a-z0-9_]{1,32})(?:@[a-z0-9_]+)?(?:\s+([\s\S]*))?$/i;

export async function grammyHandleText(
  scope: Scope,
  ctx: TextContext,
  signal: AbortSignal,
): Promise<void> {
  const match = commandPattern.exec(ctx.message.text);
  if (match?.[1]) {
    const command = scope.commandRegistry.get(match[1]);
    if (command) {
      await grammyHandleCustomCommand(
        scope,
        ctx,
        signal,
        command,
        (match[2] ?? "").trim(),
      );
      return;
    }
  }

  const {
    bot,
    database,
    opencodeClient,
    existingSessions,
    workingSessions,
    pendingPrompts,
  } = scope;

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
