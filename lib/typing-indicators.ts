import type { Session } from "~/lib/session";

export interface TypingIndicators extends Disposable {
  readonly ids: string[];
  invalidate(...sessions: Session[]): Promise<void>;
  stop(...sessionIds: string[]): void;
}
