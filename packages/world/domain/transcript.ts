type TranscriptEntry = {
  readonly id: string;
  readonly timestamp: string;
  readonly kind: "message" | "status" | "thought" | "tool";
  readonly content: string;
};

export type Transcript = {
  readonly id: string;
  readonly sessionId: string;
  readonly entries: readonly TranscriptEntry[];
};
