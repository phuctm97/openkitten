import type { OpencodeSnapshot } from "~/lib/opencode-snapshot";
import type { Session } from "~/lib/session";

export interface BusySessions {
  readonly sessionIds: readonly string[];
  invalidate(snapshot: OpencodeSnapshot, ...sessions: Session[]): void;
  check(sessionId: string): boolean;
  remove(...sessionIds: string[]): void;
}
