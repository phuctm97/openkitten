import type { AssistantMessage, Part, TextPart } from "@opencode-ai/sdk/v2";
import { grammyFormatText } from "~/lib/grammy-format-text";

interface AssistantMessagePayload {
  readonly info: AssistantMessage;
  readonly parts: readonly Part[];
}

export function grammyFormatAssistantMessage(message: AssistantMessagePayload) {
  const text = message.parts
    .filter((part): part is TextPart => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  return grammyFormatText(text);
}
