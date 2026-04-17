import { extension as mimeExtension } from "mime-types";
import { trimMime } from "~/lib/trim-mime";

export function getMimeExtension(
  filemime: string | undefined,
): string | undefined {
  const extension = mimeExtension(trimMime(filemime) ?? "");
  return extension || undefined;
}
