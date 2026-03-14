export class PendingPromptAnswerError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`pending prompt answer error: ${code}`);
    this.code = code;
  }
}
