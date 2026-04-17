import type { Context } from "grammy";
import invariant from "tiny-invariant";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammyCheckGroupTrigger } from "~/lib/grammy-check-group-trigger";
import { grammyDownloadContextFiles } from "~/lib/grammy-download-context-files";
import { fileParts } from "~/lib/grammy-file-parts";
import { grammyFormatGroupPrompt } from "~/lib/grammy-format-group-prompt";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import { PendingPrompts } from "~/lib/pending-prompts";
import type { Scope } from "~/lib/scope";
import { WorkingSessions } from "~/lib/working-sessions";

function senderName(ctx: Context): string {
  return ctx.from?.first_name ?? ctx.from?.username ?? "User";
}

function describeFile(ctx: Context, name: string): string {
  const msg = ctx.message;
  invariant(msg, "Expected file context to have a message");
  if ("photo" in msg && msg.photo) return `${name} sent a photo`;
  if ("video" in msg && msg.video) return `${name} sent a video`;
  if ("audio" in msg && msg.audio) return `${name} sent an audio file`;
  if ("voice" in msg && msg.voice) return `${name} sent a voice message`;
  if ("document" in msg && msg.document)
    return `${name} sent ${msg.document.file_name ?? "a document"}`;
  if ("sticker" in msg && msg.sticker)
    return `${name} sent a sticker${msg.sticker.emoji ? ` ${msg.sticker.emoji}` : ""}`;
  if ("animation" in msg && msg.animation) return `${name} sent a GIF`;
  if ("video_note" in msg && msg.video_note) return `${name} sent a video note`;
  return `${name} sent a file`;
}

function extractFileInfo(
  ctx: Context,
): { fileId: string; fileMime: string } | undefined {
  const msg = ctx.message;
  invariant(msg, "Expected file context to have a message");
  if ("photo" in msg && msg.photo) {
    const largest = msg.photo[msg.photo.length - 1];
    if (largest) return { fileId: largest.file_id, fileMime: "image/jpeg" };
  }
  if ("document" in msg && msg.document)
    return {
      fileId: msg.document.file_id,
      fileMime: msg.document.mime_type ?? "application/octet-stream",
    };
  if ("video" in msg && msg.video)
    return {
      fileId: msg.video.file_id,
      fileMime: msg.video.mime_type ?? "video/mp4",
    };
  if ("audio" in msg && msg.audio)
    return {
      fileId: msg.audio.file_id,
      fileMime: msg.audio.mime_type ?? "audio/mpeg",
    };
  if ("voice" in msg && msg.voice)
    return {
      fileId: msg.voice.file_id,
      fileMime: msg.voice.mime_type ?? "audio/ogg",
    };
  if ("animation" in msg && msg.animation)
    return {
      fileId: msg.animation.file_id,
      fileMime: msg.animation.mime_type ?? "video/mp4",
    };
  if ("video_note" in msg && msg.video_note)
    return { fileId: msg.video_note.file_id, fileMime: "video/mp4" };
  if ("sticker" in msg && msg.sticker)
    return { fileId: msg.sticker.file_id, fileMime: "image/webp" };
  return undefined;
}

export async function grammyHandleGroupFile(
  scope: Scope,
  ctx: Context,
  _signal: AbortSignal,
): Promise<void> {
  const {
    bot,
    database,
    opencodeClient,
    existingSessions,
    workingSessions,
    pendingPrompts,
    mediaGroupBuffer,
    attachmentStorage,
    groupMessageBuffer,
  } = scope;

  invariant(ctx.chat, "Expected file message to have a chat");
  invariant(ctx.message, "Expected file message to have a message");
  invariant(groupMessageBuffer, "Expected groupMessageBuffer in group mode");

  const chatId = ctx.chat.id;
  const threadId = ctx.msg?.message_thread_id || undefined;
  const messageId = ctx.message.message_id;
  const location = { chatId, threadId };
  const botInfo = bot.botInfo;
  const trigger = grammyCheckGroupTrigger(ctx, botInfo.username, botInfo.id);

  // Capture context before adding the current message to avoid duplication
  const name = senderName(ctx);
  const recentContext = groupMessageBuffer.recent(location);
  const fileInfo = extractFileInfo(ctx);

  // Buffer the file description (with file_id for lazy download) for future context
  groupMessageBuffer.add(location, {
    fromName: name,
    fromId: ctx.from?.id ?? 0,
    text: describeFile(ctx, name),
    messageId,
    timestamp: Date.now(),
    isBot: false,
    fileId: fileInfo?.fileId,
    fileMime: fileInfo?.fileMime,
  });

  if (trigger.type === "context") return;

  // Handle media groups
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

  const sessionId = await existingSessions.find(location, {
    createIfNotFound: true,
  });

  try {
    await pendingPrompts.protect({ sessionId, messageId });
    return;
  } catch (error) {
    if (!(error instanceof PendingPrompts.NotFoundError)) throw error;
  }

  try {
    await workingSessions.lock(sessionId, async () => {
      const agent = getSessionAgent(database, sessionId);
      const parts = await fileParts(ctx, attachmentStorage, opencodeClient);
      const contextFileParts = await grammyDownloadContextFiles(
        bot,
        opencodeClient,
        attachmentStorage,
        recentContext,
      );

      // Prepend group context to the file parts
      const contextPrompt = grammyFormatGroupPrompt({
        senderName: name,
        text: trigger.text,
        trigger: trigger.type,
        quotedText: trigger.type === "reply" ? trigger.quotedText : undefined,
        recentContext,
        botName: botInfo.first_name,
      });

      // Replace or prepend the text context
      const textPartIndex = parts.findIndex((p) => p.type === "text");
      if (textPartIndex >= 0) {
        parts[textPartIndex] = {
          type: "text",
          text: contextPrompt,
        };
      } else {
        parts.unshift({ type: "text", text: contextPrompt });
      }

      await opencodeClient.session.promptAsync(
        {
          sessionID: sessionId,
          ...(agent && { agent }),
          parts: [...parts, ...contextFileParts],
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
