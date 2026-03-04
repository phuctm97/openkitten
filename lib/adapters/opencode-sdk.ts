/** OpenCodePort adapter backed by @opencode-ai/sdk. Owns SSE reconnect logic. */

import type { FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2";
import { createOpencodeClient } from "@opencode-ai/sdk/v2";
import type {
	EventCallback,
	OpenCodePort,
	ProjectInfo,
	SessionInfo,
} from "~/lib/ports/opencode";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

function getReconnectDelay(attempt: number): number {
	return Math.min(
		RECONNECT_BASE_MS * 2 ** Math.max(0, attempt - 1),
		RECONNECT_MAX_MS,
	);
}

function waitWithAbort(ms: number, signal: AbortSignal): Promise<boolean> {
	return new Promise((resolve) => {
		if (signal.aborted) {
			resolve(false);
			return;
		}
		const onAbort = () => {
			clearTimeout(timer);
			signal.removeEventListener("abort", onAbort);
			resolve(false);
		};
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve(true);
		}, ms);
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

export class OpenCodeSdkAdapter implements OpenCodePort {
	private client: ReturnType<typeof createOpencodeClient>;
	private isListening = false;
	private activeDirectory: string | null = null;
	private abortController: AbortController | null = null;
	private eventCallback: EventCallback | null = null;

	constructor(baseUrl: string, headers: Record<string, string> = {}) {
		this.client = createOpencodeClient({ baseUrl, headers });
	}

	async getProjectInfo(): Promise<ProjectInfo> {
		const { data: project, error } = await this.client.project.current();
		if (error || !project) throw new Error("Failed to get current project");
		return { worktree: project.worktree };
	}

	async createSession(directory: string): Promise<SessionInfo> {
		const { data: session, error } = await this.client.session.create({
			directory,
		});
		if (error || !session) throw new Error("Failed to create session");
		return { id: session.id };
	}

	async prompt(
		sessionID: string,
		directory: string,
		parts: Array<TextPartInput | FilePartInput>,
	): Promise<{ error?: unknown }> {
		const { error } = await this.client.session.prompt({
			sessionID,
			directory,
			parts,
		});
		if (error) return { error };
		return {};
	}

	async abort(sessionID: string, directory: string): Promise<void> {
		await this.client.session.abort({ sessionID, directory });
	}

	async replyPermission(
		requestID: string,
		directory: string,
		reply: "once" | "always" | "reject",
	): Promise<void> {
		await this.client.permission.reply({ requestID, directory, reply });
	}

	async replyQuestion(
		requestID: string,
		directory: string,
		answers: string[][],
	): Promise<void> {
		await this.client.question.reply({ requestID, directory, answers });
	}

	async subscribeToEvents(
		directory: string,
		callback: EventCallback,
	): Promise<void> {
		if (this.isListening && this.activeDirectory === directory) {
			this.eventCallback = callback;
			return;
		}

		if (this.isListening && this.activeDirectory !== directory) {
			this.abortController?.abort();
			this.abortController = null;
			this.isListening = false;
			this.activeDirectory = null;
		}

		const controller = new AbortController();
		this.activeDirectory = directory;
		this.eventCallback = callback;
		this.isListening = true;
		this.abortController = controller;

		let attempt = 0;

		try {
			while (
				this.isListening &&
				this.activeDirectory === directory &&
				!controller.signal.aborted
			) {
				try {
					const result = await this.client.event.subscribe(
						{ directory },
						{ signal: controller.signal },
					);

					if (!result.stream)
						throw new Error("No stream returned from event subscription");

					attempt = 0;

					for await (const event of result.stream) {
						if (
							!this.isListening ||
							this.activeDirectory !== directory ||
							controller.signal.aborted
						)
							break;

						// Yield to event loop so grammY's getUpdates polling isn't starved
						await new Promise<void>((resolve) => setImmediate(resolve));

						if (this.eventCallback) {
							const cb = this.eventCallback;
							setImmediate(() => {
								try {
									cb(event);
								} catch (err) {
									console.error("[opencode-sdk] Event processing error:", err);
								}
							});
						}
					}

					if (
						!this.isListening ||
						this.activeDirectory !== directory ||
						controller.signal.aborted
					)
						break;

					attempt++;
					const delay = getReconnectDelay(attempt);
					console.log(
						`[opencode-sdk] Stream ended, reconnecting in ${delay}ms (attempt=${attempt})`,
					);
					if (!(await waitWithAbort(delay, controller.signal))) break;
				} catch (error) {
					if (
						controller.signal.aborted ||
						!this.isListening ||
						this.activeDirectory !== directory
					)
						return;

					attempt++;
					const delay = getReconnectDelay(attempt);
					console.error(
						`[opencode-sdk] Stream error, reconnecting in ${delay}ms:`,
						error,
					);
					if (!(await waitWithAbort(delay, controller.signal))) break;
				}
			}
		} finally {
			if (this.abortController === controller) {
				this.abortController = null;
				this.isListening = false;
				this.activeDirectory = null;
				this.eventCallback = null;
			}
		}
	}

	stopEventListening(): void {
		this.abortController?.abort();
		this.abortController = null;
		this.isListening = false;
		this.activeDirectory = null;
		this.eventCallback = null;
	}

	async registerMcpServer(name: string, url: string): Promise<void> {
		await this.client.mcp.add({
			name,
			config: { type: "remote", url },
		});
		await this.client.mcp.connect({ name });
	}
}
