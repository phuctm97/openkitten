import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { Bot } from "grammy";
import type { BusySessions } from "~/lib/busy-sessions";
import type { Database } from "~/lib/database";
import type { PendingPrompts } from "~/lib/pending-prompts";
import type { TypingIndicators } from "~/lib/typing-indicators";

export interface GrammyHandleContext {
  readonly bot: Bot;
  readonly database: Database;
  readonly opencodeClient: OpencodeClient;
  readonly busySessions: BusySessions;
  readonly typingIndicators: TypingIndicators;
  readonly pendingPrompts: PendingPrompts;
}
