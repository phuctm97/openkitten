export function grammyFormatQuestionReplied(answers: readonly string[]) {
  return `✓ ${answers.join(", ")}`;
}
