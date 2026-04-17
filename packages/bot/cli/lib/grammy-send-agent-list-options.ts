import type { Agent } from "@opencode-ai/sdk/v2";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export interface GrammySendAgentListOptions extends GrammySendOptions {
  readonly currentAgent: string;
  readonly availableAgents: readonly Agent[];
}
