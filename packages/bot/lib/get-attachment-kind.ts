import { getAttachmentMime } from "~/lib/get-attachment-mime";
import { getFileExtension } from "~/lib/get-file-extension";

export function getAttachmentKind(
  filemime: string | undefined,
  filename: string,
): "animation" | "audio" | "document" | "photo" | "sticker" | "video" {
  const mime = getAttachmentMime(filemime, filename);
  const ext = getFileExtension(filename);

  if (mime === "application/x-tgsticker" || ext === "tgs") return "sticker";

  if (mime === "image/gif" || ext === "gif") return "animation";

  if (mime === "image/svg+xml" || ext === "svg") return "document";

  if (mime?.startsWith("image/")) return "photo";

  if (mime?.startsWith("video/")) return "video";

  if (mime?.startsWith("audio/")) return "audio";

  return "document";
}
