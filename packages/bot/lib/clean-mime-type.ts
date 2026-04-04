import { cleanText } from "~/lib/clean-text";

export function cleanMimeType(value: string | undefined): string | undefined {
  return cleanText(value)?.split(";", 1)[0]?.trim().toLowerCase();
}
