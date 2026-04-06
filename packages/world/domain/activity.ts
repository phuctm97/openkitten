type ActivityActor = {
  readonly id: string;
  readonly kind: "cat" | "human" | "system";
  readonly label: string;
};

type ActivityPayload = Readonly<Record<string, string>>;

type ActivitySubject = {
  readonly id: string;
  readonly kind:
    | "cabinet"
    | "comment"
    | "file"
    | "goal"
    | "memo"
    | "notice"
    | "rule"
    | "session"
    | "thread"
    | "whiteboard";
  readonly label: string;
};

type ActivityType =
  | "comment-added"
  | "notice-created"
  | "session-started"
  | "thread-assigned"
  | "thread-updated";

export type Activity = {
  readonly id: string;
  readonly timestamp: string;
  readonly actor: ActivityActor;
  readonly type: ActivityType;
  readonly subject: ActivitySubject;
  readonly payload: ActivityPayload;
};
