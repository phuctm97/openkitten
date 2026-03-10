export function formatQuestionReplied(answers: ReadonlyArray<string>) {
  return `✓ ${answers.join(", ")}`;
}
