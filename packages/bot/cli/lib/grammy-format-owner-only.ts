import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatOwnerOnly() {
  return grammyFormatText("> 🔒 Only the bot owner can use this command.");
}
