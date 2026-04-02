import type { AssistantMessage, Part } from "@opencode-ai/sdk/v2";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export interface GrammySendAssistantMessageOptions extends GrammySendOptions {
  readonly message: {
    readonly info: AssistantMessage;
    readonly parts: readonly Part[];
  };
}
