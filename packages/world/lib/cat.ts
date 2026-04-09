export type Cat = {
  activeGoal: string;
  activeSessionLabel: string;
  assignedThreadIds: readonly string[];
  id: string;
  name: string;
  state: "awake" | "resting";
};
