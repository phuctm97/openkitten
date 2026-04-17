import { getFileExtension } from "~/lib/get-file-extension";
import { getMimeExtension } from "~/lib/get-mime-extension";
import { trimText } from "~/lib/trim-text";

export function getAttachmentName(
  filename: string | undefined,
  filemime: string | undefined,
  fallbackName: string,
): string {
  const name = trimText(filename);
  const ext = getMimeExtension(filemime);
  if (name) return getFileExtension(name) || !ext ? name : `${name}.${ext}`;

  return ext ? `${fallbackName}.${ext}` : fallbackName;
}
