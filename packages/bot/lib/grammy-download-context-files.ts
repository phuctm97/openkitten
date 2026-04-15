import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { Bot } from "grammy";
import type { AttachmentStorage } from "~/lib/attachment-storage";
import type { GroupMessage } from "~/lib/group-message-buffer";
import { logger } from "~/lib/logger";
import { modelSupportsFile } from "~/lib/model-supports-file";

interface FilePart {
  readonly type: "file";
  readonly mime: string;
  readonly filename: string;
  readonly url: string;
}

interface TextPart {
  readonly type: "text";
  readonly text: string;
}

export async function grammyDownloadContextFiles(
  bot: Bot,
  opencodeClient: OpencodeClient,
  attachmentStorage: AttachmentStorage,
  recentContext: readonly GroupMessage[],
): Promise<readonly (FilePart | TextPart)[]> {
  const contextWithFiles = recentContext.filter(
    (msg) => msg.fileId && msg.fileMime,
  );
  if (contextWithFiles.length === 0) return [];

  const parts: (FilePart | TextPart)[] = [];
  for (const msg of contextWithFiles) {
    if (!msg.fileId || !msg.fileMime) continue;
    try {
      const file = await bot.api.getFile(msg.fileId);
      if (!file.file_path) continue;
      const response = await fetch(
        new URL(
          file.file_path,
          `https://api.telegram.org/file/bot${bot.token}/`,
        ),
      );
      if (!response.ok) continue;
      const mime = msg.fileMime;
      const filename = `context-${msg.messageId}.${file.file_path.split(".").pop() ?? "bin"}`;
      const bytes = await response.arrayBuffer();

      if (await modelSupportsFile(opencodeClient, mime)) {
        const data = Buffer.from(bytes).toString("base64");
        parts.push({
          type: "file",
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
          type: "text",
          text: `[${msg.fromName}'s file saved to: ${savedPath}]`,
        });
      }
    } catch (error) {
      logger.warn("Failed to download context file", error, {
        fileId: msg.fileId,
      });
    }
  }
  return parts;
}
