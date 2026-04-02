import type { QuestionInfo } from "@opencode-ai/sdk/v2";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export interface GrammySendQuestionMessageOptions extends GrammySendOptions {
  readonly question: QuestionInfo;
}
