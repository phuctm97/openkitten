type NoticeStatus = "Read" | "Resolved" | "Unread";

type NoticeTarget = {
  readonly id: string;
  readonly kind: "activity" | "comment" | "session" | "thread";
  readonly label: string;
};

export type Notice = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly status: NoticeStatus;
  readonly createdAt: string;
  readonly target: NoticeTarget;
  readonly threadId?: string;
};
