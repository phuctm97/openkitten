import type { Agent } from "@opencode-ai/sdk/v2";
import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatAgentList(
  currentAgent: string,
  availableAgents: readonly Agent[],
) {
  const list = availableAgents
    .map((a) => {
      const current = a.name === currentAgent ? " _(current)_" : "";
      return `- \`${a.name}\`${current}: ${a.description || "N/A"}`;
    })
    .join("\n");
  return grammyFormatText(`> 📋 Here are the available agents.\n\n${list}`);
}
