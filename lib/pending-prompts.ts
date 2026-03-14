import type { PendingPromptAnswerOptions } from "~/lib/pending-prompt-answer-options";
import type { PendingPromptResult } from "~/lib/pending-prompt-result";
import type { Session } from "~/lib/session";

export interface PendingPrompts extends AsyncDisposable {
  readonly sessionIds: readonly string[];
  invalidate(...sessions: Session[]): Promise<void>;
  flush(): Promise<void>;
  answer(options: PendingPromptAnswerOptions): Promise<void>;
  resolve(sessionId: string, promptResult: PendingPromptResult): Promise<void>;
  dismiss(...sessionIds: string[]): Promise<void>;
}
