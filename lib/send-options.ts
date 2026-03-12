import type { Bot } from "grammy";

export interface SendOptions {
  readonly bot: Bot;
  readonly ignoreErrors: boolean;
  readonly chatId: number;
  readonly threadId: number | undefined;
}
