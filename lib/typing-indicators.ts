import type { Session } from "~/lib/session";

export interface TypingIndicators extends Disposable {
  readonly ids: readonly string[];
  invalidate(...sessions: Session[]): Promise<void>;
  stop(...sessionIds: string[]): void;
}
