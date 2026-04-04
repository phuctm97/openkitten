import { lookup as mimeLookup } from "mime-types";
import { trimMime } from "~/lib/trim-mime";

export function getAttachmentMime(
  mimeType: string | undefined,
  filename: string,
): string | undefined {
  const trimmedMime = trimMime(mimeType);
  if (trimmedMime && trimmedMime !== "application/octet-stream") {
    return trimmedMime;
  }

  const filenameMime = mimeLookup(filename);
  if (filenameMime) return filenameMime.toLowerCase();

  return trimmedMime;
}
