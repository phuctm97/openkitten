import type { Context, Filter } from "grammy";
import invariant from "tiny-invariant";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

type MessageContext =
  | Filter<Context, "message:text">
  | Filter<Context, "message:photo">;

function promptText(ctx: MessageContext): string {
  if ("text" in ctx.message) return ctx.message.text;
  return ctx.message.caption ?? "";
}

async function promptParts(ctx: MessageContext) {
  if ("text" in ctx.message) {
    return [{ type: "text" as const, text: ctx.message.text }];
  }

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

export async function grammyHandleText(
  {
    bot,
    database,
    opencodeClient,
    existingSessions,
    workingSessions,
    pendingPrompts,
  }: Scope,
  ctx: MessageContext,
): Promise<void> {
  const sessionId = await existingSessions.find(
    {
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
    },
    { createIfNotFound: true },
  );

  // If the session has an active pending prompt, answer it.
  const text = promptText(ctx);
  if (text.length > 0) {
    try {
      await pendingPrompts.answer({
        sessionId,
        messageId: ctx.message.message_id,
        text,
      });
      return;
    } catch (error) {
      if (!(error instanceof PendingPrompts.NotFoundError)) throw error;
    }
  } else if (pendingPrompts.check(sessionId)) {
    try {
      await pendingPrompts.notifyPending({
        sessionId,
        messageId: ctx.message.message_id,
      });
      return;
    } catch (error) {
      if (!(error instanceof PendingPrompts.NotFoundError)) throw error;
    }
  }

  // Otherwise, lock the session and send the message to OpenCode.
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
