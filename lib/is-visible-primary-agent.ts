import type { Agent } from "@opencode-ai/sdk/v2";

export function isVisiblePrimaryAgent(agent: Agent): boolean {
  return agent.mode !== "subagent" && agent.hidden !== true;
}
