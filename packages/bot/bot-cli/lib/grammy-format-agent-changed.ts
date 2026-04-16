import type { Agent } from "@opencode-ai/sdk/v2";
import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatAgentChanged(agent: Agent) {
  const description = agent.description || "N/A";
  return grammyFormatText(
    `> 🤖 The agent is now \`${agent.name}\`.\n\n\`\`\`description\n${description}\n\`\`\``,
  );
}
