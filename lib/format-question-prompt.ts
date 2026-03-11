import type { QuestionInfo } from "@opencode-ai/sdk/v2";

export function formatQuestionPrompt(question: QuestionInfo) {
  const multi = question.multiple === true;
  const custom = question.custom !== false;
  let text = multi
    ? "Select all that apply and press *Confirm*"
    : "Choose one of the following options";
  if (custom) {
    text += ", or reply with your own answer";
  }
  return `_${text}_`;
}
