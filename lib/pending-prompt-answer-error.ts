export class PendingPromptAnswerError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Pending prompt answer failed: ${code}`);
    this.code = code;
  }
}
