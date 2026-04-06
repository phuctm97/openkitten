type CommentAuthor = {
  readonly id: string;
  readonly kind: "cat" | "human";
  readonly label: string;
};

type CommentMention = {
  readonly id: string;
  readonly kind: "cat" | "file" | "goal" | "human" | "thread";
  readonly label: string;
};

export type Comment = {
  readonly id: string;
  readonly author: CommentAuthor;
  readonly timestamp: string;
  readonly threadId: string;
  readonly content: string;
  readonly mentions: readonly CommentMention[];
};
