import type { OpencodeSnapshot } from "~/lib/opencode-snapshot";
import type { PendingPromptAnswerOptions } from "~/lib/pending-prompt-answer-options";
import type { PendingPromptResolveOptions } from "~/lib/pending-prompt-resolve-options";
import type { Session } from "~/lib/session";

export interface PendingPrompts extends AsyncDisposable {
  readonly sessionIds: readonly string[];
  invalidate(snapshot: OpencodeSnapshot, ...sessions: Session[]): Promise<void>;
  flush(...sessionIds: string[]): Promise<void>;
  answer(options: PendingPromptAnswerOptions): Promise<void>;
  resolve(options: PendingPromptResolveOptions): Promise<void>;
  dismiss(...sessionIds: string[]): Promise<void>;
}
