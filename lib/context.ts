import type {
	AccumulatedFile,
	PendingPermission,
	QuestionState,
} from "~/lib/types";

export class BotContext {
	/** Accumulated text by messageID */
	readonly accumulatedText = new Map<string, string>();
	/** Accumulated files by messageID */
	readonly accumulatedFiles = new Map<string, AccumulatedFile[]>();
	/** Pending permission requests by Telegram messageId */
	readonly pendingPermissions = new Map<number, PendingPermission>();
	/** Dedup set for tool call IDs */
	readonly processedToolCalls = new Set<string>();
	/** Active question flow */
	questionState: QuestionState | null = null;
	/** Current session ID */
	sessionID: string | null = null;
	/** Active chat ID for SSE events */
	eventChatId: number | null = null;
	/** Typing indicator timer */
	typingTimer: ReturnType<typeof setInterval> | null = null;

	/** Clear transient state (keeps sessionID) */
	resetTransient(): void {
		this.accumulatedText.clear();
		this.accumulatedFiles.clear();
		this.pendingPermissions.clear();
		this.processedToolCalls.clear();
		this.questionState = null;
		this.eventChatId = null;
		if (this.typingTimer) {
			clearInterval(this.typingTimer);
			this.typingTimer = null;
		}
	}

	/** Clear everything including sessionID */
	resetAll(): void {
		this.resetTransient();
		this.sessionID = null;
	}
}
