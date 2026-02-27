import type { Bot } from "grammy";

export interface GrammySendOptions {
  readonly bot: Bot;
  readonly chatId: number;
  readonly threadId: number | undefined;
}
