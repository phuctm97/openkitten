import type { Bot } from "grammy";
import type { Database } from "~/lib/database";

export interface UpgradeOpenkittenOptions {
  readonly bot: Bot;
  readonly database: Database;
}
