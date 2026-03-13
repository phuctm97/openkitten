import type { Session } from "~/lib/session";

export interface TypingIndicators extends Disposable {
  readonly sessionIds: string[];
  invalidate(...sessions: Session[]): Promise<void>;
  stop(...sessionIds: string[]): void;
}
