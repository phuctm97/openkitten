import type { QuestionInfo } from "@opencode-ai/sdk/v2";
import { grammyFormatMessage } from "~/lib/grammy-format-message";

export function grammyFormatQuestionMessage(question: QuestionInfo) {
  const lines = [`> 🏷️ ${question.header}\n`, question.question];
  if (question.options.length > 0) {
    for (const opt of question.options) {
      lines.push(`- **${opt.label}**: ${opt.description}`);
    }
  }
  return grammyFormatMessage(lines.join("\n"));
}
