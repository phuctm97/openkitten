import type {
  PermissionRequest,
  QuestionRequest,
  SessionStatus,
} from "@opencode-ai/sdk/v2";

export interface OpencodeSnapshot {
  readonly statuses: { readonly [sessionId: string]: SessionStatus };
  readonly questions: readonly QuestionRequest[];
  readonly permissions: readonly PermissionRequest[];
}
