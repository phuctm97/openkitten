import { GrammyError } from "grammy";

// Checks if a Grammy error indicates the chat/thread is permanently
// unreachable (bot blocked, kicked, user deactivated, chat deleted).
// When true, the session should be dismissed/stopped — the bot can
// no longer interact with this chat.
const goneDescriptions = [
  "chat not found",
  "CHAT_ID_INVALID",
  "message_thread_not_found",
];

export function grammyCheckGoneError(error: unknown): boolean {
  if (!(error instanceof GrammyError)) return false;
  if (error.error_code === 403) return true;
  if (error.error_code === 400) {
    return goneDescriptions.some((d) => error.description.includes(d));
  }
  return false;
}
