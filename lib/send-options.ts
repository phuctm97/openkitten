import type { Bot as Client } from "grammy";

export interface SendOptions {
  readonly client: Client;
  readonly ignoreErrors: boolean;
  readonly chatId: number;
  readonly threadId: number | undefined;
}
