export class PendingPromptNotFoundError extends Error {
  constructor() {
    super("No pending prompt found");
  }
}
