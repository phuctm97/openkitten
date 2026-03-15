import type { OpencodeSnapshot } from "~/lib/opencode-snapshot";
import type { Session } from "~/lib/session";

export interface WorkingSessions {
  readonly sessionIds: readonly string[];
  invalidate(snapshot: OpencodeSnapshot, ...sessions: Session[]): void;
  check(sessionId: string): boolean;
  remove(...sessionIds: string[]): void;
}
