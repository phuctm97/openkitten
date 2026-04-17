import type { GrammySendOptions } from "~/lib/grammy-send-options";

export interface GrammySendTextOptions extends GrammySendOptions {
  readonly text: string;
}
