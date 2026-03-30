import type { Agent } from "@opencode-ai/sdk/v2";
import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatAgentList(
  currentAgent: string,
  availableAgents: readonly Agent[],
) {
  const list = availableAgents
    .map((a) => `- \`${a.name}\`: ${a.description || "N/A"}`)
    .join("\n");
  return grammyFormatText(
    `**Current agent:** \`${currentAgent}\`\n\n**Available agents:**\n${list}`,
  );
}
