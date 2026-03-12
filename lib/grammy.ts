import type { Bot } from "grammy";

export interface Grammy extends AsyncDisposable {
  readonly stopped: Promise<void>;
  readonly bot: Bot;
}
