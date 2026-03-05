import type { FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2";

export type PromptParts = Array<TextPartInput | FilePartInput>;
export type NoticeType = "started" | "stopped" | "busy" | "error" | "help";
export type FormattedMessage = { text: string; parseMode?: "MarkdownV2" };
