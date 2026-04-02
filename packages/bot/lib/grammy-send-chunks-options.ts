import type { GrammyChunk } from "~/lib/grammy-chunk";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export interface GrammySendChunksOptions extends GrammySendOptions {
  readonly chunks: readonly GrammyChunk[];
}
