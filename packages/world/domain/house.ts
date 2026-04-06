type HouseProp = {
  readonly id: string;
  readonly kind: "cabinet" | "desk" | "inbox" | "whiteboard";
  readonly label: string;
};

export type House = {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly humanId: string;
  readonly catIds: readonly string[];
  readonly goalIds: readonly string[];
  readonly threadIds: readonly string[];
  readonly noticeIds: readonly string[];
  readonly sessionIds: readonly string[];
  readonly props: readonly HouseProp[];
};
