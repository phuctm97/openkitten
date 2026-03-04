/**
 * Pure event processor — takes an OpenCode SSE event, mutates state in-place,
 * returns Effect descriptors. No IO happens here.
 */

import type { Event } from "@opencode-ai/sdk/v2";
import {
	buildPermissionKeyboard,
	buildQuestionKeyboard,
	formatPermissionMessage,
	formatQuestionMessage,
} from "./keyboard-builder";
import type {
	Effect,
	QuestionItem,
	QuestionState,
	SessionState,
} from "./types";

export function processEvent(
	event: Event,
	sessionID: string,
	state: SessionState,
): Effect[] {
	switch (event.type) {
		case "message.part.updated":
			return handleMessagePartUpdated(event, sessionID, state);
		case "message.updated":
			return handleMessageUpdated(event, sessionID, state);
		case "session.error":
			return handleSessionError(event, sessionID, state);
		case "session.idle":
			return handleSessionIdle(event, sessionID);
		case "permission.asked":
			return handlePermissionAsked(event, sessionID);
		case "question.asked":
			return handleQuestionAsked(event, sessionID, state);
		default:
			return [];
	}
}

function handleMessagePartUpdated(
	event: Event,
	sessionID: string,
	state: SessionState,
): Effect[] {
	const { part } = event.properties as {
		part: {
			sessionID: string;
			messageID: string;
			type: string;
			text?: string;
		};
	};
	if (part.sessionID !== sessionID) return [];

	if (part.type === "text" && "text" in part && part.text) {
		// Each event contains the full current text — overwrite, don't append
		state.accumulatedText.set(part.messageID, part.text);
		return [{ type: "start_typing" }];
	}

	// file parts and tool parts are ignored — MCP server handles outbound files
	return [];
}

function handleMessageUpdated(
	event: Event,
	sessionID: string,
	state: SessionState,
): Effect[] {
	const { info } = event.properties as {
		info: {
			sessionID: string;
			role: string;
			id: string;
			time?: { completed?: number };
		};
	};
	if (info.sessionID !== sessionID) return [];
	if (info.role !== "assistant") return [];

	if (!info.time?.completed) return [];

	const messageID = info.id;
	const text = state.accumulatedText.get(messageID) ?? "";

	// Clean up accumulated text for this message
	state.accumulatedText.delete(messageID);

	const effects: Effect[] = [];

	if (text.length > 0) {
		effects.push({ type: "send_formatted_message", text });
	}

	// Typing only stops when ALL accumulated messages are cleared
	if (state.accumulatedText.size === 0) {
		effects.push({ type: "stop_typing" });
	}

	return effects;
}

function handleSessionError(
	event: Event,
	sessionID: string,
	_state: SessionState,
): Effect[] {
	const props = event.properties as {
		sessionID: string;
		error?: {
			data?: { message?: string };
			message?: string;
			name?: string;
		};
	};
	if (props.sessionID !== sessionID) return [];

	const msg =
		props.error?.data?.message ?? props.error?.message ?? "Unknown error";

	return [
		{ type: "stop_typing" },
		{ type: "reset_state" },
		{ type: "send_notice", kind: "error", message: msg },
	];
}

function handleSessionIdle(event: Event, sessionID: string): Effect[] {
	const props = event.properties as { sessionID: string };
	if (props.sessionID !== sessionID) return [];

	return [{ type: "stop_typing" }, { type: "reset_state" }];
}

function handlePermissionAsked(event: Event, sessionID: string): Effect[] {
	const request = event.properties as {
		id: string;
		sessionID: string;
		permission: string;
		patterns: string[];
	};
	if (request.sessionID !== sessionID) return [];

	// Don't stop typing — AI continues after permission is granted
	const text = formatPermissionMessage(request.permission, request.patterns);
	const keyboard = buildPermissionKeyboard();

	return [
		{
			type: "send_message_with_keyboard",
			text,
			keyboard,
			storeAs: "permission",
			permissionRequestID: request.id,
		},
	];
}

function handleQuestionAsked(
	event: Event,
	sessionID: string,
	state: SessionState,
): Effect[] {
	const props = event.properties as {
		id: string;
		sessionID: string;
		questions: QuestionItem[];
	};
	if (props.sessionID !== sessionID) return [];

	const qs: QuestionState = {
		requestID: props.id,
		questions: props.questions,
		currentIndex: 0,
		answers: [],
		selectedOptions: new Map(),
		customAnswers: new Map(),
		activeMessageId: null,
	};
	state.questionState = qs;

	const question = qs.questions[0];
	if (!question) return [{ type: "stop_typing" }];

	const text = formatQuestionMessage(qs);
	const keyboard = buildQuestionKeyboard(
		question,
		0,
		qs.selectedOptions.get(0) ?? new Set(),
	);

	return [
		{ type: "stop_typing" },
		{
			type: "send_message_with_keyboard",
			text,
			keyboard,
			storeAs: "question",
		},
	];
}
