import type { Context, Filter } from "grammy";
import invariant from "tiny-invariant";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyCheckGroupTrigger } from "~/lib/grammy-check-group-trigger";
import { grammyDownloadContextFiles } from "~/lib/grammy-download-context-files";
import { grammyFormatGroupPrompt } from "~/lib/grammy-format-group-prompt";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

type TextContext = Filter<Context, "message:text">;

function senderName(ctx: TextContext): string {
  return ctx.from?.first_name ?? ctx.from?.username ?? "User";
}

export async function grammyHandleGroupText(
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
    groupMessageBuffer,
  } = scope;

  invariant(groupMessageBuffer, "Expected groupMessageBuffer in group mode");

  const chatId = ctx.chat.id;
  const threadId = ctx.msg.message_thread_id || undefined;
  const location = { chatId, threadId };
  const botInfo = bot.botInfo;
  const trigger = grammyCheckGroupTrigger(ctx, botInfo.username, botInfo.id);

  // Capture context before adding the current message to avoid duplication
  const recentContext = groupMessageBuffer.recent(location);

  // Buffer the message for future context
  groupMessageBuffer.add(location, {
    fromName: senderName(ctx),
    fromId: ctx.from?.id ?? 0,
    text: ctx.message.text,
    messageId: ctx.message.message_id,
    timestamp: Date.now(),
    isBot: false,
  });

  if (trigger.type === "context") return;

  const sessionId = await existingSessions.find(location, {
    createIfNotFound: true,
  });

  try {
    await pendingPrompts.answer({
      sessionId,
      messageId: ctx.message.message_id,
      text: trigger.text,
    });
    return;
  } catch (error) {
    if (!(error instanceof PendingPrompts.NotFoundError)) throw error;
  }
  const prompt = grammyFormatGroupPrompt({
    senderName: senderName(ctx),
    text: trigger.text,
    trigger: trigger.type,
    quotedText: trigger.quotedText,
    recentContext,
    botName: botInfo.first_name,
  });

  try {
    await workingSessions.lock(sessionId, async () => {
      const agent = getSessionAgent(database, sessionId);
      const contextFileParts = await grammyDownloadContextFiles(
        bot,
        opencodeClient,
        scope.attachmentStorage,
        recentContext,
      );
      await opencodeClient.session.promptAsync(
        {
          sessionID: sessionId,
          ...(agent && { agent }),
          parts: [{ type: "text", text: prompt }, ...contextFileParts],
        },
        { throwOnError: true },
      );
    });
  } catch (error) {
    if (!(error instanceof WorkingSessions.LockedError)) throw error;
    await grammySendSessionPending({
      bot,
      chatId,
      threadId,
      replyToMessageId: ctx.message.message_id,
    });
  }
}
