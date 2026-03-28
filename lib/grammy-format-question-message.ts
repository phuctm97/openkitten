import type { QuestionInfo } from "@opencode-ai/sdk/v2";
import { grammyFormatText } from "~/lib/grammy-format-text";

export function grammyFormatQuestionMessage(question: QuestionInfo) {
  const lines = [`> 🏷️ ${question.header}\n`, question.question];
  if (question.options.length > 0) {
    for (const opt of question.options) {
      lines.push(`- **${opt.label}**: ${opt.description}`);
    }
  }
  return grammyFormatText(lines.join("\n"));
}
