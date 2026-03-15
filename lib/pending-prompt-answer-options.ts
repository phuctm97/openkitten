interface PendingPromptAnswerCallbackOptions {
  readonly sessionId: string;
  readonly callbackQueryId: string;
  readonly callbackQueryData: string;
}

interface PendingPromptAnswerCustomOptions {
  readonly sessionId: string;
  readonly text: string;
}

export type PendingPromptAnswerOptions =
  | PendingPromptAnswerCallbackOptions
  | PendingPromptAnswerCustomOptions;
