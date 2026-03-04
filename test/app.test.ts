import { describe, expect, it } from "bun:test";
import type { Event } from "@opencode-ai/sdk/v2";
import { App } from "~/lib/core/app";
import { createFileSystemStub } from "~/test/stubs/filesystem";
import { createOpenCodeStub } from "~/test/stubs/opencode";
import { createStorageStub } from "~/test/stubs/storage";
import { createTelegramStub } from "~/test/stubs/telegram";
import { createTimerStub } from "~/test/stubs/timer";

function createApp() {
	const telegram = createTelegramStub();
	const opencode = createOpenCodeStub();
	const storage = createStorageStub();
	const fs = createFileSystemStub();
	const timer = createTimerStub();

	const app = new App(
		telegram,
		opencode,
		storage,
		fs,
		timer,
		123,
		"/test/project",
	);

	return { app, telegram, opencode, storage, fs, timer };
}

describe("App", () => {
	describe("startCommand", () => {
		it("creates a new session and sends notice", async () => {
			const { app, opencode, storage, telegram } = createApp();
			opencode.nextSessionId = "new-session-42";

			await app.startCommand();

			expect(storage.currentSessionID).toBe("new-session-42");
			expect(opencode.calls.some((c) => c.method === "createSession")).toBe(
				true,
			);
			// Should send a notice
			const sends = telegram.calls.filter((c) => c.method === "sendMessage");
			expect(sends.length).toBeGreaterThan(0);
		});
	});

	describe("stopCommand", () => {
		it("aborts session and sends notice", async () => {
			const { app, opencode, storage, telegram } = createApp();
			storage.currentSessionID = "active-session";

			await app.stopCommand();

			expect(opencode.calls.some((c) => c.method === "abort")).toBe(true);
			const sends = telegram.calls.filter((c) => c.method === "sendMessage");
			expect(sends.length).toBeGreaterThan(0);
		});

		it("sends error when no active session", async () => {
			const { app, telegram } = createApp();

			await app.stopCommand();

			const sends = telegram.calls.filter((c) => c.method === "sendMessage");
			expect(sends.length).toBeGreaterThan(0);
		});
	});

	describe("helpCommand", () => {
		it("sends help notice", async () => {
			const { app, telegram } = createApp();

			await app.helpCommand();

			const sends = telegram.calls.filter((c) => c.method === "sendMessage");
			expect(sends.length).toBeGreaterThan(0);
		});
	});

	describe("handleTextMessage", () => {
		it("auto-creates session if none exists", async () => {
			const { app, opencode, storage } = createApp();
			opencode.nextSessionId = "auto-session";

			await app.handleTextMessage("Hello AI");

			// Wait for async prompt
			await Bun.sleep(50);

			expect(storage.currentSessionID).toBe("auto-session");
			expect(opencode.calls.some((c) => c.method === "createSession")).toBe(
				true,
			);
			expect(opencode.calls.some((c) => c.method === "prompt")).toBe(true);
		});

		it("uses existing session", async () => {
			const { app, opencode, storage } = createApp();
			storage.currentSessionID = "existing-session";

			await app.handleTextMessage("Hello");

			await Bun.sleep(50);

			const promptCall = opencode.calls.find((c) => c.method === "prompt");
			expect(promptCall).toBeDefined();
			expect(promptCall?.args[0]).toBe("existing-session");
		});
	});

	describe("handleEvent", () => {
		it("processes text message part and sends formatted on completion", async () => {
			const { app, telegram, storage } = createApp();
			storage.currentSessionID = "sess1";

			// Simulate text streaming
			app.handleEvent({
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: "sess1",
						messageID: "msg1",
						type: "text",
						text: "Hello from AI",
					},
				},
			} as unknown as Event);

			// Wait for async effects
			await Bun.sleep(50);

			// Should have started typing
			expect(telegram.calls.some((c) => c.method === "sendChatAction")).toBe(
				true,
			);

			// Simulate completion
			app.handleEvent({
				type: "message.updated",
				properties: {
					info: {
						sessionID: "sess1",
						role: "assistant",
						id: "msg1",
						time: { completed: Date.now() },
					},
				},
			} as unknown as Event);

			await Bun.sleep(50);

			// Should have sent the message
			const sends = telegram.calls.filter((c) => c.method === "sendMessage");
			expect(sends.length).toBeGreaterThan(0);
		});
	});

	describe("handleCallbackQuery — permission", () => {
		it("processes permission callback", async () => {
			const { app, telegram, storage } = createApp();
			storage.currentSessionID = "sess1";

			// Simulate permission asked → stores in state
			app.handleEvent({
				type: "permission.asked",
				properties: {
					id: "perm1",
					sessionID: "sess1",
					permission: "file_read",
					patterns: ["/etc/*"],
				},
			} as unknown as Event);

			await Bun.sleep(100);

			// Get the message ID that was sent
			const sendCalls = telegram.calls.filter(
				(c) => c.method === "sendMessage",
			);
			const permMsgId = sendCalls.length > 0 ? sendCalls.length : 1;

			await app.handleCallbackQuery("cb1", "permission:once", permMsgId);

			// Should have answered and replied
			expect(
				telegram.calls.some((c) => c.method === "answerCallbackQuery"),
			).toBe(true);
		});
	});

	describe("shutdown", () => {
		it("stops typing and event listening", () => {
			const { app, opencode } = createApp();
			app.shutdown();

			expect(
				opencode.calls.some((c) => c.method === "stopEventListening"),
			).toBe(true);
		});
	});
});
