import { trimText } from "~/lib/trim-text";

export function trimMime(value: string | undefined): string | undefined {
  return trimText(value)?.split(";", 1)[0]?.trim().toLowerCase();
}
