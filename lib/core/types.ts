import type { InlineKeyboardData } from "~/lib/ports/telegram";
import type { TimerHandle } from "~/lib/ports/timer";

// ── Shared domain types ─────────────────────────────────────────────────────

export interface PendingPermission {
	requestID: string;
	messageId: number;
}

export interface QuestionOption {
	label: string;
	description: string;
}

export interface QuestionItem {
	header: string;
	question: string;
	options: QuestionOption[];
	multiple?: boolean;
}

export interface QuestionState {
	requestID: string;
	questions: QuestionItem[];
	currentIndex: number;
	answers: string[][];
	selectedOptions: Map<number, Set<number>>;
	customAnswers: Map<number, string>;
	activeMessageId: number | null;
}

// ── Media types ─────────────────────────────────────────────────────────────

export interface MediaDescriptor {
	fileId: string;
	fileSize?: number;
	mimeType: string;
	fileName?: string;
	caption?: string;
}

// ── Effect types (core logic returns these; executor performs IO) ────────────

export type Effect =
	| { type: "start_typing" }
	| { type: "stop_typing" }
	| { type: "reset_state" }
	| {
			type: "send_formatted_message";
			text: string;
	  }
	| {
			type: "send_message_with_keyboard";
			text: string;
			keyboard: InlineKeyboardData;
			/** Store resulting message ID here after send */
			storeAs?: "permission" | "question";
			/** For permission: requestID to associate */
			permissionRequestID?: string;
	  }
	| {
			type: "send_notice";
			kind: NoticeKind;
			message: string;
			codeBlock?: { language: string; content: string };
	  }
	| {
			type: "delete_message";
			messageId: number;
	  };

export type NoticeKind = "started" | "stopped" | "busy" | "error" | "help";

// ── Callback effect types ───────────────────────────────────────────────────

export type CallbackEffect =
	| { type: "answer_callback"; text?: string; showAlert?: boolean }
	| {
			type: "edit_message";
			text: string;
			keyboard?: InlineKeyboardData;
	  }
	| { type: "delete_message" }
	| {
			type: "reply_permission";
			requestID: string;
			reply: "once" | "always" | "reject";
	  }
	| {
			type: "reply_question";
			requestID: string;
			answers: string[][];
	  }
	| { type: "clear_question_state" }
	| { type: "remove_pending_permission"; messageId: number }
	| { type: "start_typing" }
	| { type: "stop_typing" }
	| {
			type: "advance_question";
			questionState: QuestionState;
			questionIndex: number;
	  }
	| {
			type: "show_question";
			questionState: QuestionState;
	  };

// ── Session state shape ─────────────────────────────────────────────────────

export interface SessionState {
	accumulatedText: Map<string, string>;
	pendingPermissions: Map<number, PendingPermission>;
	questionState: QuestionState | null;
	typingHandle: TimerHandle | null;
}
