type ThreadStatus = "Closed" | "Open";

export type Thread = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly status: ThreadStatus;
  readonly assigneeId?: string;
  readonly goalIds: readonly string[];
  readonly commentIds: readonly string[];
  readonly activityIds: readonly string[];
  readonly currentSessionId?: string;
};
