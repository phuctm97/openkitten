export type PendingPromptResult =
  | {
      readonly kind: "question-replied";
      readonly requestId: string;
    }
  | {
      readonly kind: "question-rejected";
      readonly requestId: string;
    }
  | {
      readonly kind: "permission-replied";
      readonly requestId: string;
      readonly reply: "once" | "always" | "reject";
    };
