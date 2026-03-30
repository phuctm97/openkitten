import type { GrammySendOptions } from "~/lib/grammy-send-options";

export interface GrammySendAgentNotFoundOptions extends GrammySendOptions {
  readonly name: string;
}
