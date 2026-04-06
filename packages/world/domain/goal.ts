type GoalStatus = "Closed" | "Open";

export type Goal = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly status: GoalStatus;
  readonly threadIds: readonly string[];
};
