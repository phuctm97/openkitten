import type { Session } from "~/lib/session";

export interface TypingIndicators extends Disposable {
  invalidate(...sessions: Session[]): Promise<void>;
}
