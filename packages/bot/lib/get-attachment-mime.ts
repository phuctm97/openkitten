import { lookup as mimeLookup } from "mime-types";
import { trimMime } from "~/lib/trim-mime";

export function getAttachmentMime(
  filemime: string | undefined,
  filename: string,
): string | undefined {
  const trimmedMime = trimMime(filemime);
  if (trimmedMime && trimmedMime !== "application/octet-stream") {
    return trimmedMime;
  }

  const filenameMime = mimeLookup(filename);
  if (filenameMime) return filenameMime.toLowerCase();

  return trimmedMime;
}
