import type { Bot as Client } from "grammy";
import type { MessageChunk } from "~/lib/message-chunk";

export interface SendChunksOptions {
  readonly client: Client;
  readonly chunks: MessageChunk[];
  readonly ignoreErrors: boolean;
  readonly chatId: number;
  readonly threadId: number | undefined;
}
