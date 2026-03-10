import type { QuestionInfo } from "@opencode-ai/sdk/v2";
import { formatMessage } from "~/lib/format-message";

export function formatQuestionMessage(question: QuestionInfo) {
  const lines = [`> ❔ ${question.header}`, "", question.question];
  if (question.options.length > 0) {
    lines.push("");
    for (const opt of question.options) {
      lines.push(`- **${opt.label}**: ${opt.description}`);
    }
  }
  return formatMessage(lines.join("\n"));
}
