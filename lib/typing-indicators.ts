import type { Session } from "~/lib/session";

export interface TypingIndicators extends Disposable {
  invalidate(session: Session): void;
}
