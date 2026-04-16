import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { parse as parseContentType } from "content-type";
import type { Context } from "grammy";
import { extension, lookup } from "mime-types";
import invariant from "tiny-invariant";
import type { AttachmentStorage } from "~/lib/attachment-storage";
import { modelSupportsFile } from "~/lib/model-supports-file";

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
  if ("photo" in msg && msg.photo) return "image/jpeg";
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
  fileId: string,
  mime: string,
): string {
  if (telegramFilename) return telegramFilename;
  return `${fileId}.${extension(mime) || "bin"}`;
}

export async function fileParts(
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
  const filename = resolveFilename(telegramFilename, file.file_id, mime);
  const bytes = await response.arrayBuffer();
  const parts = [];

  const caption = ctx.message?.caption;
  if (caption) {
    parts.push({ type: "text" as const, text: caption });
  }

  if (await modelSupportsFile(opencodeClient, mime)) {
    const data = Buffer.from(bytes).toString("base64");
    parts.push({
      type: "file" as const,
      mime,
      filename,
      url: `data:${mime};base64,${data}`,
    });
  } else {
    const savedPath = await attachmentStorage.write(
      file.file_id,
      filename,
      mime,
      new Uint8Array(bytes),
    );
    parts.push({
      type: "text" as const,
      text: `Attached file saved to: ${savedPath}`,
    });
  }

  return parts;
}
