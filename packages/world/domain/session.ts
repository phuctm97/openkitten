import type { Transcript } from "~/domain/transcript";

type SessionExecutor = {
  readonly id: string;
  readonly kind: "local" | "remote";
  readonly label: string;
};

type SessionStatus =
  | "Completed"
  | "Failed"
  | "Interrupted"
  | "Running"
  | "Terminated";

export type Session = {
  readonly id: string;
  readonly catId: string;
  readonly executor: SessionExecutor;
  readonly wakeReasons: readonly string[];
  readonly claimedThreadIds: readonly string[];
  readonly status: SessionStatus;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly transcript?: Transcript;
};
