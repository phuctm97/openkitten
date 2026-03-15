import type { OpencodeSnapshot } from "~/lib/opencode-snapshot";
import type { Session } from "~/lib/session";

export interface TypingIndicators extends Disposable {
  readonly sessionIds: readonly string[];
  invalidate(snapshot: OpencodeSnapshot, ...sessions: Session[]): Promise<void>;
  stop(...sessionIds: string[]): void;
}
