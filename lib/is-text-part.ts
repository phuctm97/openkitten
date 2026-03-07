import type { Part, TextPart } from "@opencode-ai/sdk/v2";

export function isTextPart(part: Part): part is TextPart {
  return part.type === "text";
}
