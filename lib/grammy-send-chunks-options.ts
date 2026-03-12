import type { GrammyMessageChunk } from "~/lib/grammy-message-chunk";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export interface GrammySendChunksOptions extends GrammySendOptions {
  readonly chunks: GrammyMessageChunk[];
}
