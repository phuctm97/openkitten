import type { PendingPromptResolveResult } from "~/lib/pending-prompt-resolve-result";
import type { Session } from "~/lib/session";

export interface PendingPrompts extends Disposable {
  readonly sessionIds: readonly string[];
  invalidate(...sessions: Session[]): Promise<void>;
  flush(): Promise<void>;
  answer(sessionId: string, callbackId: string): Promise<void>;
  resolve(sessionId: string, result: PendingPromptResolveResult): void;
  dismiss(...sessionIds: string[]): void;
}
