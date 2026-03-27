import { convert } from "telegram-markdown-v2";

export function grammyFormatPermissionPrompt() {
  return convert("_How would you like to proceed?_");
}
