import type { Context, Filter } from "grammy";
import invariant from "tiny-invariant";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

type PhotoContext = Filter<Context, "message:photo">;

async function promptParts(ctx: PhotoContext) {
  const file = await ctx.getFile();
  invariant(file.file_path, "Expected Telegram photo to have a file path");
  const response = await fetch(
    new URL(
      file.file_path,
      `https://api.telegram.org/file/bot${ctx.api.token}/`,
    ),
  );
  invariant(response.ok, "Expected Telegram photo download to succeed");
  const data = Buffer.from(await response.arrayBuffer()).toString("base64");

  return [
    { type: "text" as const, text: ctx.message.caption ?? "" },
    {
      type: "file" as const,
      mime: "image/jpeg",
      filename: "telegram-photo.jpg",
      url: `data:image/jpeg;base64,${data}`,
    },
  ];
}

export async function grammyHandlePhoto(
  {
    bot,
    database,
    opencodeClient,
    existingSessions,
    workingSessions,
    pendingPrompts,
  }: Scope,
  ctx: PhotoContext,
): Promise<void> {
  const sessionId = await existingSessions.find(
    {
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
    },
    { createIfNotFound: true },
  );

  if (pendingPrompts.check(sessionId)) {
    try {
      await pendingPrompts.protect({
        sessionId,
        messageId: ctx.message.message_id,
      });
      return;
    } catch (error) {
      if (!(error instanceof PendingPrompts.NotFoundError)) throw error;
    }
  }

  try {
    await workingSessions.lock(sessionId, async () => {
      const agent = getSessionAgent(database, sessionId);
      await opencodeClient.session.promptAsync(
        {
          sessionID: sessionId,
          ...(agent && { agent }),
          parts: await promptParts(ctx),
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
