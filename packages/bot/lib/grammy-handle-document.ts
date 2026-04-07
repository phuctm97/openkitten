import { parse as parseContentType } from "content-type";
import type { Context, Filter } from "grammy";
import { extension, lookup } from "mime-types";
import invariant from "tiny-invariant";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

type DocumentContext = Filter<Context, "message:document">;

function documentMime(ctx: DocumentContext, response: Response): string {
  const telegramMime = ctx.message.document.mime_type;
  if (telegramMime) return telegramMime;

  const header = response.headers.get("content-type");
  if (header) {
    try {
      return parseContentType(header).type;
    } catch {
      // Fall through to file-name inference when the header is invalid.
    }
  }

  const fileName = ctx.message.document.file_name;
  if (fileName) {
    const type = lookup(fileName) || undefined;
    if (type) return type;
  }

  return "application/octet-stream";
}

function documentFilename(
  ctx: DocumentContext,
  filePath: string,
  mime: string,
): string {
  const telegramName = ctx.message.document.file_name;
  if (telegramName) return telegramName;

  const pathName = filePath.split("/").filter(Boolean).at(-1);
  if (pathName) return pathName;

  return `telegram-document.${extension(mime) || "bin"}`;
}

async function documentParts(ctx: DocumentContext) {
  const file = await ctx.getFile();
  invariant(file.file_path, "Expected Telegram document to have a file path");
  const response = await fetch(
    new URL(
      file.file_path,
      `https://api.telegram.org/file/bot${ctx.api.token}/`,
    ),
  );
  invariant(response.ok, "Expected Telegram document download to succeed");
  const mime = documentMime(ctx, response);
  const data = Buffer.from(await response.arrayBuffer()).toString("base64");
  const parts = [];

  if (ctx.message.caption) {
    parts.push({ type: "text" as const, text: ctx.message.caption });
  }

  parts.push({
    type: "file" as const,
    mime,
    filename: documentFilename(ctx, file.file_path, mime),
    url: `data:${mime};base64,${data}`,
  });

  return parts;
}

export async function grammyHandleDocument(
  {
    bot,
    database,
    opencodeClient,
    existingSessions,
    workingSessions,
    pendingPrompts,
    mediaGroupBuffer,
  }: Scope,
  ctx: DocumentContext,
  _signal: AbortSignal,
): Promise<void> {
  const mediaGroupId = ctx.message.media_group_id;
  if (mediaGroupId) {
    mediaGroupBuffer.add(mediaGroupId, {
      chatId: ctx.chat.id,
      threadId: ctx.msg.message_thread_id || undefined,
      messageId: ctx.message.message_id,
      download: () => documentParts(ctx),
    });
    return;
  }

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
          parts: await documentParts(ctx),
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
