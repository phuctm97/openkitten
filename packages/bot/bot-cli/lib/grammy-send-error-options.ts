import type { GrammySendOptions } from "~/lib/grammy-send-options";

export interface GrammySendErrorOptions extends GrammySendOptions {
  readonly error: unknown;
}
