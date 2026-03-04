import type { Event, FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2";
import type {
	EventCallback,
	OpenCodePort,
	ProjectInfo,
	SessionInfo,
} from "~/lib/ports/opencode";

export interface OpenCodeCall {
	method: string;
	args: unknown[];
}

export function createOpenCodeStub(): OpenCodePort & {
	calls: OpenCodeCall[];
	pushEvent(event: Event): void;
	nextSessionId: string;
	promptError: unknown | null;
} {
	const calls: OpenCodeCall[] = [];
	let eventCallback: EventCallback | null = null;
	let nextSessionId = "test-session-1";
	let promptError: unknown | null = null;

	return {
		calls,
		get nextSessionId() {
			return nextSessionId;
		},
		set nextSessionId(v: string) {
			nextSessionId = v;
		},
		get promptError() {
			return promptError;
		},
		set promptError(v: unknown | null) {
			promptError = v;
		},

		pushEvent(event: Event): void {
			if (eventCallback) eventCallback(event);
		},

		async getProjectInfo(): Promise<ProjectInfo> {
			calls.push({ method: "getProjectInfo", args: [] });
			return { worktree: "/test/project" };
		},

		async createSession(directory: string): Promise<SessionInfo> {
			calls.push({ method: "createSession", args: [directory] });
			return { id: nextSessionId };
		},

		async prompt(
			sessionID: string,
			directory: string,
			parts: Array<TextPartInput | FilePartInput>,
		): Promise<{ error?: unknown }> {
			calls.push({ method: "prompt", args: [sessionID, directory, parts] });
			if (promptError) {
				const err = promptError;
				promptError = null;
				return { error: err };
			}
			return {};
		},

		async abort(sessionID: string, directory: string): Promise<void> {
			calls.push({ method: "abort", args: [sessionID, directory] });
		},

		async replyPermission(
			requestID: string,
			directory: string,
			reply: "once" | "always" | "reject",
		): Promise<void> {
			calls.push({
				method: "replyPermission",
				args: [requestID, directory, reply],
			});
		},

		async replyQuestion(
			requestID: string,
			directory: string,
			answers: string[][],
		): Promise<void> {
			calls.push({
				method: "replyQuestion",
				args: [requestID, directory, answers],
			});
		},

		async subscribeToEvents(
			directory: string,
			callback: EventCallback,
		): Promise<void> {
			calls.push({ method: "subscribeToEvents", args: [directory] });
			eventCallback = callback;
		},

		stopEventListening(): void {
			calls.push({ method: "stopEventListening", args: [] });
			eventCallback = null;
		},

		async registerMcpServer(name: string, url: string): Promise<void> {
			calls.push({ method: "registerMcpServer", args: [name, url] });
		},
	};
}
