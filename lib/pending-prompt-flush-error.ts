export class PendingPromptFlushError extends Error {
  constructor(count: number) {
    super(
      `Pending prompt flush failed: ${count} ${count === 1 ? "session" : "sessions"}`,
    );
  }
}
