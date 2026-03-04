/**
 * App class — orchestrator that holds state and all ports.
 * Routes Telegram events to pure processors, then executes effects.
 */

import type { Event, FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2";
import type { FileSystemPort } from "~/lib/ports/filesystem";
import type { OpenCodePort } from "~/lib/ports/opencode";
import type { StoragePort } from "~/lib/ports/storage";
import type { TelegramPort } from "~/lib/ports/telegram";
import type { TimerPort } from "~/lib/ports/timer";
import {
	processCustomTextInput,
	processPermissionCallback,
	processQuestionCancel,
	processQuestionSelect,
	processQuestionSubmit,
} from "./callback-processor";
import {
	type EffectDeps,
	executeCallbackEffects,
	executeEffects,
} from "./effect-executor";
import { processEvent } from "./event-processor";
import { buildFileParts, resolveFilename } from "./media-pipeline";
import { createSessionState, resetSessionState } from "./session-state";
import type { MediaDescriptor, SessionState } from "./types";

const SESSION_LOCKED_RETRY_DELAY_MS = 1000;
const SESSION_LOCKED_MAX_RETRIES = 3;

export class App {
	private state: SessionState;

	constructor(
		private telegram: TelegramPort,
		private opencode: OpenCodePort,
		private storage: StoragePort,
		private fs: FileSystemPort,
		private timer: TimerPort,
		private chatId: number,
		private directory: string,
	) {
		this.state = createSessionState();
	}

	private get deps(): EffectDeps {
		return {
			telegram: this.telegram,
			opencode: this.opencode,
			timer: this.timer,
			fs: this.fs,
			chatId: this.chatId,
			directory: this.directory,
			state: this.state,
		};
	}

	// ── Initialization ────────────────────────────────────────────────────────

	async initialize(): Promise<void> {
		await this.opencode
			.subscribeToEvents(this.directory, (event) => this.handleEvent(event))
			.catch((err) => console.error("[app] SSE subscription error:", err));
	}

	// ── Event handling ────────────────────────────────────────────────────────

	handleEvent(event: Event): void {
		const sessionID = this.storage.getSessionID();
		if (!sessionID) return;

		try {
			const effects = processEvent(event, sessionID, this.state);
			executeEffects(effects, this.deps).catch((err) =>
				console.error("[app] executeEffects error:", err),
			);
		} catch (err) {
			console.error("[app] processEvent error:", err);
		}
	}

	// ── Text messages ─────────────────────────────────────────────────────────

	async handleTextMessage(text: string): Promise<void> {
		// Check if waiting for custom question input
		const effects = processCustomTextInput(text, this.state);
		if (effects) {
			await executeCallbackEffects(effects, {
				...this.deps,
				callbackQueryId: "",
				callbackMessageId: this.state.questionState?.activeMessageId ?? 0,
			});
			return;
		}

		await this.promptOpenCode([{ type: "text", text }]);
	}

	// ── Media messages ────────────────────────────────────────────────────────

	async handleMediaMessage(
		descriptor: MediaDescriptor,
		token: string,
	): Promise<void> {
		// Download file from Telegram
		const fileInfo = await this.telegram.getFile(descriptor.fileId);
		if (!fileInfo.file_path) {
			await this.sendNotice("error", "Failed to get file info.");
			return;
		}

		const url = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
		const buffer = await this.telegram.downloadFile(url);
		if (!buffer) {
			await this.sendNotice("error", "Failed to download file.");
			return;
		}

		// Save to temp directory
		const filename = resolveFilename(descriptor.mimeType, descriptor.fileName);
		const tempDir = this.fs.makeTempDir();
		const filePath = `${tempDir}/${filename}`;
		await this.fs.writeFile(filePath, buffer);

		// Build prompt parts
		const parts: Array<TextPartInput | FilePartInput> = buildFileParts(
			filePath,
			descriptor.mimeType,
			filename,
		);
		if (descriptor.caption) {
			parts.push({ type: "text", text: descriptor.caption });
		}

		await this.promptOpenCode(parts);
	}

	// ── Callback queries ──────────────────────────────────────────────────────

	async handleCallbackQuery(
		callbackQueryId: string,
		data: string,
		messageId: number,
	): Promise<void> {
		const cbDeps = {
			...this.deps,
			callbackQueryId,
			callbackMessageId: messageId,
		};

		if (data.startsWith("permission:")) {
			const effects = processPermissionCallback(
				data,
				messageId,
				this.state,
				this.directory,
			);
			await executeCallbackEffects(effects, cbDeps);
		} else if (data.startsWith("question:")) {
			const parts = data.split(":");
			const action = parts[1];
			const qIdx = Number.parseInt(parts[2] ?? "", 10);

			if (Number.isNaN(qIdx)) {
				await this.telegram.answerCallbackQuery(callbackQueryId);
				return;
			}

			let effects: import("./types").CallbackEffect[];

			switch (action) {
				case "select": {
					const optIdx = Number.parseInt(parts[3] ?? "", 10);
					if (Number.isNaN(optIdx)) {
						await this.telegram.answerCallbackQuery(callbackQueryId);
						return;
					}
					effects = processQuestionSelect(qIdx, optIdx, this.state);
					break;
				}
				case "submit":
					effects = processQuestionSubmit(qIdx, this.state);
					break;
				case "cancel":
					effects = processQuestionCancel(qIdx, this.state, this.directory);
					break;
				default:
					await this.telegram.answerCallbackQuery(callbackQueryId);
					return;
			}

			await executeCallbackEffects(effects, cbDeps);
		} else {
			await this.telegram.answerCallbackQuery(callbackQueryId);
		}
	}

	// ── Commands ──────────────────────────────────────────────────────────────

	async startCommand(): Promise<void> {
		try {
			const session = await this.opencode.createSession(this.directory);

			// Stop typing and reset state
			if (this.state.typingHandle) {
				this.timer.clearInterval(this.state.typingHandle);
				this.state.typingHandle = null;
			}
			resetSessionState(this.state);

			this.storage.setSessionID(session.id);

			await this.sendNotice("started", "New session created.", {
				language: "ID",
				content: session.id,
			});
		} catch {
			await this.sendNotice("error", "Failed to create session.");
		}
	}

	async stopCommand(): Promise<void> {
		const sessionID = this.storage.getSessionID();
		if (!sessionID) {
			await this.sendNotice("error", "No active session.");
			return;
		}

		await this.opencode.abort(sessionID, this.directory).catch(console.error);

		if (this.state.typingHandle) {
			this.timer.clearInterval(this.state.typingHandle);
			this.state.typingHandle = null;
		}
		resetSessionState(this.state);

		await this.sendNotice("stopped", "Current request aborted.");
	}

	async helpCommand(): Promise<void> {
		await this.sendNotice(
			"help",
			[
				"OpenKitten \u2014 AI agent on Telegram",
				"",
				"Send any text message to chat with the AI.",
				"The AI can browse the web, read/write files, and run commands.",
				"",
				"/start \u2014 Start a new session",
				"/stop \u2014 Abort the current request",
				"/help \u2014 Show this message",
			].join("\n"),
		);
	}

	// ── Shutdown ──────────────────────────────────────────────────────────────

	shutdown(): void {
		if (this.state.typingHandle) {
			this.timer.clearInterval(this.state.typingHandle);
			this.state.typingHandle = null;
		}
		this.opencode.stopEventListening();
	}

	// ── Private helpers ─────────────────────────────────────────────────────

	private async promptOpenCode(
		parts: Array<TextPartInput | FilePartInput>,
	): Promise<void> {
		// Ensure event subscription is active
		await this.opencode
			.subscribeToEvents(this.directory, (event) => this.handleEvent(event))
			.catch((err) => console.error("[app] SSE subscription error:", err));

		// Auto-create session if none exists
		let sessionID = this.storage.getSessionID();
		if (!sessionID) {
			try {
				const session = await this.opencode.createSession(this.directory);
				sessionID = session.id;
				this.storage.setSessionID(sessionID);
			} catch {
				await this.sendNotice("error", "Failed to create session.");
				return;
			}
		}

		// Fire-and-forget with SessionLockedError retry
		const prompt = async (retries = 0): Promise<void> => {
			const { error } = await this.opencode.prompt(
				sessionID,
				this.directory,
				parts,
			);

			if (error) {
				const errMsg =
					typeof error === "object" && error !== null && "message" in error
						? (error as { message: string }).message
						: String(error);

				if (errMsg.includes("SessionLocked")) {
					if (retries < SESSION_LOCKED_MAX_RETRIES) {
						console.log(
							`[app] Session locked, retrying in ${SESSION_LOCKED_RETRY_DELAY_MS}ms (attempt ${retries + 1})`,
						);
						await Bun.sleep(SESSION_LOCKED_RETRY_DELAY_MS);
						return prompt(retries + 1);
					}
					await this.sendNotice(
						"busy",
						"Still processing the previous message. Use /stop to abort.",
					);
					return;
				}

				console.error("[app] prompt error:", error);
				if (this.state.typingHandle) {
					this.timer.clearInterval(this.state.typingHandle);
					this.state.typingHandle = null;
				}
				await this.sendNotice("error", errMsg);
			}
		};

		prompt().catch(async (err) => {
			console.error("[app] prompt error:", err);
			if (this.state.typingHandle) {
				this.timer.clearInterval(this.state.typingHandle);
				this.state.typingHandle = null;
			}
			await this.sendNotice("error", "Error sending prompt.");
		});
	}

	private async sendNotice(
		kind: import("./types").NoticeKind,
		message: string,
		codeBlock?: { language: string; content: string },
	): Promise<void> {
		const effects: import("./types").Effect[] = [
			{ type: "send_notice", kind, message, codeBlock },
		];
		await executeEffects(effects, this.deps);
	}
}
