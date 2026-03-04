/** OpenCode API boundary — session management, prompting, events, permissions, questions, MCP. */

import type { Event, FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2";

export type EventCallback = (event: Event) => void;

export interface ProjectInfo {
	worktree: string;
}

export interface SessionInfo {
	id: string;
}

export interface OpenCodePort {
	getProjectInfo(): Promise<ProjectInfo>;

	createSession(directory: string): Promise<SessionInfo>;

	prompt(
		sessionID: string,
		directory: string,
		parts: Array<TextPartInput | FilePartInput>,
	): Promise<{ error?: unknown }>;

	abort(sessionID: string, directory: string): Promise<void>;

	replyPermission(
		requestID: string,
		directory: string,
		reply: "once" | "always" | "reject",
	): Promise<void>;

	replyQuestion(
		requestID: string,
		directory: string,
		answers: string[][],
	): Promise<void>;

	subscribeToEvents(directory: string, callback: EventCallback): Promise<void>;

	stopEventListening(): void;

	registerMcpServer(name: string, url: string): Promise<void>;
}
