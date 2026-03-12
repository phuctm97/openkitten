import type { MessageChunk } from "~/lib/message-chunk";
import type { SendOptions } from "~/lib/send-options";

export interface SendChunksOptions extends SendOptions {
  readonly chunks: MessageChunk[];
}
