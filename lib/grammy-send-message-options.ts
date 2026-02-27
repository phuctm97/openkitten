import type { GrammySendOptions } from "~/lib/grammy-send-options";

export interface GrammySendMessageOptions extends GrammySendOptions {
  readonly text: string;
}
