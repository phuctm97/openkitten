import type { Agent } from "@opencode-ai/sdk/v2";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export interface GrammySendAgentChangedOptions extends GrammySendOptions {
  readonly agent: Agent;
}
