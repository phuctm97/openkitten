import { InputFile } from "grammy";
import { extension as mimeExtension, lookup as mimeLookup } from "mime-types";

interface GrammyCreateTelegramAttachmentOptions {
  readonly bytes: Uint8Array;
  readonly fallbackName: string;
  readonly filename?: string | undefined;
  readonly mimeType?: string | undefined;
}

type AttachmentKind =
  | "animation"
  | "audio"
  | "document"
  | "photo"
  | "sticker"
  | "video";

export function grammyCreateTelegramAttachment({
  bytes,
  fallbackName,
  filename,
  mimeType,
}: GrammyCreateTelegramAttachmentOptions): {
  readonly filename: string;
  readonly kind: AttachmentKind;
  readonly media: InputFile;
} {
  const resolvedFilename = attachmentFilename(filename, mimeType, fallbackName);
  return {
    filename: resolvedFilename,
    kind: attachmentKind(mimeType, resolvedFilename),
    media: new InputFile(bytes, resolvedFilename),
  };
}

function attachmentFilename(
  filename: string | undefined,
  mimeType: string | undefined,
  fallbackName: string,
): string {
  const name = cleanText(filename);
  const ext = mimeExtension(cleanMimeType(mimeType) ?? "");
  if (name) return fileExtension(name) || !ext ? name : `${name}.${ext}`;

  return ext ? `${fallbackName}.${ext}` : fallbackName;
}

function attachmentKind(
  mimeType: string | undefined,
  filename: string,
): AttachmentKind {
  const mime = attachmentMimeType(mimeType, filename);
  const ext = fileExtension(filename);

  if (mime === "application/x-tgsticker" || ext === "tgs") return "sticker";

  if (mime === "image/gif" || ext === "gif") return "animation";

  if (mime === "image/svg+xml" || ext === "svg") return "document";

  if (mime?.startsWith("image/")) return "photo";

  if (mime?.startsWith("video/")) return "video";

  if (mime?.startsWith("audio/")) return "audio";

  return "document";
}

function attachmentMimeType(
  mimeType: string | undefined,
  filename: string,
): string | undefined {
  const cleanedMime = cleanMimeType(mimeType);
  if (cleanedMime && cleanedMime !== "application/octet-stream") {
    return cleanedMime;
  }

  const filenameMime = mimeLookup(filename);
  if (typeof filenameMime === "string") return filenameMime.toLowerCase();

  return cleanedMime;
}

function fileExtension(filename: string): string | undefined {
  const index = filename.lastIndexOf(".");
  if (index < 0 || index === filename.length - 1) return undefined;
  return filename.slice(index + 1).toLowerCase();
}

function cleanMimeType(value: string | undefined): string | undefined {
  return cleanText(value)?.split(";", 1)[0]?.trim().toLowerCase();
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}
