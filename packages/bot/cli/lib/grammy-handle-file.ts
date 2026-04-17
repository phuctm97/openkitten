import type { Context } from "grammy";
import invariant from "tiny-invariant";
import { getSessionAgent } from "~/lib/get-session-agent";
import { fileParts } from "~/lib/grammy-file-parts";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

export async function grammyHandleFile(
  scope: Scope,
  ctx: Context,
  _signal: AbortSignal,
): Promise<void> {
  invariant(ctx.chat, "Expected file message to have a chat");
  invariant(ctx.message, "Expected file message to have a message");

  const {
    bot,
    database,
    opencodeClient,
    existingSessions,
    workingSessions,
    pendingPrompts,
    mediaGroupBuffer,
    attachmentStorage,
  } = scope;

  const chatId = ctx.chat.id;
  const threadId = ctx.msg?.message_thread_id || undefined;
  const messageId = ctx.message.message_id;

  const mediaGroupId = ctx.message.media_group_id;
  if (mediaGroupId) {
    mediaGroupBuffer.add(mediaGroupId, {
      chatId,
      threadId,
      messageId,
      download: () => fileParts(ctx, attachmentStorage, opencodeClient),
    });
    return;
  }

  const sessionId = await existingSessions.find(
    { chatId, threadId },
    { createIfNotFound: true },
  );

  try {
    await pendingPrompts.protect({ sessionId, messageId });
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
          parts: await fileParts(ctx, attachmentStorage, opencodeClient),
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
      replyToMessageId: messageId,
    });
  }
}
