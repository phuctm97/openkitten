import { extension as mimeExtension } from "mime-types";
import { trimMime } from "~/lib/trim-mime";

export function getMimeExtension(
  mimeType: string | undefined,
): string | undefined {
  const extension = mimeExtension(trimMime(mimeType) ?? "");
  return extension || undefined;
}
