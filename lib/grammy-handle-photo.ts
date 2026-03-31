import { parse as parseContentType } from "content-type";
import type { Context, Filter } from "grammy";
import { extension, lookup } from "mime-types";
import invariant from "tiny-invariant";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

type PhotoContext = Filter<Context, "message:photo">;

function promptMime(filePath: string, response: Response): string {
  const header = response.headers.get("content-type");
  if (header) {
    try {
      const type = parseContentType(header).type;
      if (type.startsWith("image/")) return type;
    } catch {
      // Fall through to file-path inference when Telegram returns an invalid header.
    }
  }
  try {
    const detected = lookup(filePath);
    if (typeof detected === "string" && detected.startsWith("image/")) {
      return detected;
    }
  } catch {
    // Fall through to the default when MIME lookup fails unexpectedly.
  }
  return "image/jpeg";
}

function promptFilename(filePath: string, mime: string): string {
  const filename = filePath.split("/").filter(Boolean).at(-1);
  if (filename) return filename;
  return `telegram-photo.${extension(mime) || "jpeg"}`;
}

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
  const mime = promptMime(file.file_path, response);
  const data = Buffer.from(await response.arrayBuffer()).toString("base64");
  const parts = [];

  if (ctx.message.caption) {
    parts.push({ type: "text" as const, text: ctx.message.caption });
  }

  parts.push({
    type: "file" as const,
    mime,
    filename: promptFilename(file.file_path, mime),
    url: `data:${mime};base64,${data}`,
  });

  return parts;
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

  try {
    await pendingPrompts.protect({
      sessionId,
      messageId: ctx.message.message_id,
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
