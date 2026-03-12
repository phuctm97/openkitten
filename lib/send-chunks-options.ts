import type { GrammyMessageChunk } from "~/lib/grammy-message-chunk";
import type { SendOptions } from "~/lib/send-options";

export interface SendChunksOptions extends SendOptions {
  readonly chunks: GrammyMessageChunk[];
}
