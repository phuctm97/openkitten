type CatExecutor = {
  readonly id: string;
  readonly kind: "local" | "remote";
  readonly label: string;
};

type CatStatus = "Idle" | "Resting" | "Working";

export type Cat = {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly flavor: string;
  readonly status: CatStatus;
  readonly defaultExecutor: CatExecutor;
  readonly assignedThreadIds: readonly string[];
  readonly activeSessionId?: string;
};
