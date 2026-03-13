export function grammyFormatQuestionReplied(answers: ReadonlyArray<string>) {
  return `✓ ${answers.join(", ")}`;
}
