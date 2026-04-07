import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { parse as parseContentType } from "content-type";
import type { Context } from "grammy";
import { extension, lookup } from "mime-types";
import invariant from "tiny-invariant";
import type { AttachmentStorage } from "~/lib/attachment-storage";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { supportsInput } from "~/lib/model-capabilities";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

function extractTelegramMime(ctx: Context): string | undefined {
  const msg = ctx.message;
  invariant(msg, "Expected context to have a message");
  if ("document" in msg && msg.document) return msg.document.mime_type;
  if ("video" in msg && msg.video) return msg.video.mime_type;
  if ("audio" in msg && msg.audio) return msg.audio.mime_type;
  if ("voice" in msg && msg.voice) return msg.voice.mime_type;
  if ("animation" in msg && msg.animation) return msg.animation.mime_type;
  if ("video_note" in msg && msg.video_note) return "video/mp4";
  if ("sticker" in msg && msg.sticker) return "image/webp";
  return undefined;
}

function extractTelegramFilename(ctx: Context): string | undefined {
  const msg = ctx.message;
  invariant(msg, "Expected context to have a message");
  if ("document" in msg && msg.document) return msg.document.file_name;
  if ("video" in msg && msg.video) return msg.video.file_name;
  if ("audio" in msg && msg.audio) return msg.audio.file_name;
  if ("animation" in msg && msg.animation) return msg.animation.file_name;
  return undefined;
}

function resolveMime(
  telegramMime: string | undefined,
  filePath: string,
  response: Response,
): string {
  if (telegramMime) return telegramMime;
  const header = response.headers.get("content-type");
  if (header) {
    try {
      return parseContentType(header).type;
    } catch {
      // Fall through to file-path inference.
    }
  }
  const pathMime = lookup(filePath) || undefined;
  if (pathMime) return pathMime;
  return "application/octet-stream";
}

function resolveFilename(
  telegramFilename: string | undefined,
  filePath: string,
  mime: string,
  fallbackPrefix: string,
): string {
  if (telegramFilename) return telegramFilename;
  const pathName = filePath.split("/").filter(Boolean).at(-1);
  if (pathName) return pathName;
  return `${fallbackPrefix}.${extension(mime) || "bin"}`;
}

async function fileParts(
  ctx: Context,
  attachmentStorage: AttachmentStorage,
  opencodeClient: OpencodeClient,
) {
  const file = await ctx.getFile();
  invariant(file.file_path, "Expected Telegram file to have a file path");
  const response = await fetch(
    new URL(
      file.file_path,
      `https://api.telegram.org/file/bot${ctx.api.token}/`,
    ),
  );
  invariant(response.ok, "Expected Telegram file download to succeed");

  const telegramMime = extractTelegramMime(ctx);
  const telegramFilename = extractTelegramFilename(ctx);
  const mime = resolveMime(telegramMime, file.file_path, response);
  const filename = resolveFilename(
    telegramFilename,
    file.file_path,
    mime,
    "telegram-file",
  );
  const bytes = await response.arrayBuffer();
  const savedPath = await attachmentStorage.write(
    filename,
    new Uint8Array(bytes),
  );
  const parts = [];

  const caption = ctx.message?.caption;
  if (caption) {
    parts.push({ type: "text" as const, text: caption });
  }

  if (await supportsInput(opencodeClient, mime)) {
    const data = Buffer.from(bytes).toString("base64");
    parts.push({
      type: "file" as const,
      mime,
      filename,
      url: `data:${mime};base64,${data}`,
    });
  }

  parts.push({
    type: "text" as const,
    text: `Attached file saved to: ${savedPath}`,
  });

  return parts;
}

export async function grammyHandleFile(
  {
    bot,
    database,
    opencodeClient,
    existingSessions,
    workingSessions,
    pendingPrompts,
    mediaGroupBuffer,
    attachmentStorage,
  }: Scope,
  ctx: Context,
  _signal: AbortSignal,
): Promise<void> {
  invariant(ctx.chat, "Expected file message to have a chat");
  invariant(ctx.message, "Expected file message to have a message");
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
