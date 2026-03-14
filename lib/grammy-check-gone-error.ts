import { GrammyError } from "grammy";

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
