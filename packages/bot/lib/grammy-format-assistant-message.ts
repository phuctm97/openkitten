import type { AssistantMessage, Part } from "@opencode-ai/sdk/v2";
import { grammyBuildAssistantMessageSections } from "~/lib/grammy-build-assistant-message-sections";
import { grammyFormatText } from "~/lib/grammy-format-text";
import { grammyRenderAssistantMessageSection } from "~/lib/grammy-render-assistant-message-section";

export function grammyFormatAssistantMessage(
  info: AssistantMessage,
  parts: readonly Part[],
) {
  const text = grammyBuildAssistantMessageSections(info, parts)
    .map(grammyRenderAssistantMessageSection)
    .filter((section): section is string => !!section)
    .join("\n\n");
  return grammyFormatText(text);
}
