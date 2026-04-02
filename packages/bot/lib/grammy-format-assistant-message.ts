import type { AssistantMessage, Part, TextPart } from "@opencode-ai/sdk/v2";
import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatAssistantMessage(
  _info: AssistantMessage,
  parts: readonly Part[],
) {
  const text = parts
    .filter((part): part is TextPart => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  return grammyFormatText(text);
}
