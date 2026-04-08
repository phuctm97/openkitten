import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { Bot } from "grammy";
import type { AttachmentStorage } from "~/lib/attachment-storage";
import type { Database } from "~/lib/database";
import type { ExistingSessions } from "~/lib/existing-sessions";
import type { FloatingPromises } from "~/lib/floating-promises";
import type { MediaGroupBuffer } from "~/lib/media-group-buffer";
import type { PendingPrompts } from "~/lib/pending-prompts";
import type { ProcessingMessages } from "~/lib/processing-messages";
import type { Shutdown } from "~/lib/shutdown";
import type { TypingIndicators } from "~/lib/typing-indicators";
import type { WorkingSessions } from "~/lib/working-sessions";

export interface Scope {
  readonly bot: Bot;
  readonly database: Database;
  readonly shutdown: Shutdown;
  readonly opencodeClient: OpencodeClient;
  readonly existingSessions: ExistingSessions;
  readonly workingSessions: WorkingSessions;
  readonly pendingPrompts: PendingPrompts;
  readonly processingMessages: ProcessingMessages;
  readonly floatingPromises: FloatingPromises;
  readonly mediaGroupBuffer: MediaGroupBuffer;
  readonly attachmentStorage: AttachmentStorage;
  readonly typingIndicators: TypingIndicators;
}
