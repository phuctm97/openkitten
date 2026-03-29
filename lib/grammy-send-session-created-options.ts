import type { GrammySendOptions } from "~/lib/grammy-send-options";

export interface GrammySendSessionCreatedOptions extends GrammySendOptions {
  readonly sessionId: string;
}
