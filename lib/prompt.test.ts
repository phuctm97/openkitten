import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Api, Context } from "grammy";
import { BotContext } from "~/lib/context";

// biome-ignore lint: mock return types are intentionally loose for test flexibility
const mockSessionCreate = mock(
	(): Promise<unknown> =>
		Promise.resolve({ data: { id: "new-session-123" }, error: null }),
);
// biome-ignore lint: mock return types are intentionally loose for test flexibility
const mockSessionPrompt = mock(
	(): Promise<unknown> => Promise.resolve({ error: null }),
);

mock.module("~/lib/opencode", () => ({
	getClient: () => ({
		session: { create: mockSessionCreate, prompt: mockSessionPrompt },
	}),
	getDirectory: () => "/test/project",
}));

import {
	promptOpenCode,
	SESSION_LOCKED_MAX_RETRIES,
	SESSION_LOCKED_RETRY_DELAY_MS,
} from "~/lib/prompt";

function mockApi(): Api {
	return {
		sendChatAction: mock(() => Promise.resolve(true)),
		sendMessage: mock(() =>
			Promise.resolve({ message_id: 1, date: 0, chat: { id: 1 } }),
		),
	} as unknown as Api;
}

function mockCtx(chatId = 123): Context {
	return {
		chat: { id: chatId },
		api: mockApi(),
	} as unknown as Context;
}

describe("prompt constants", () => {
	test("SESSION_LOCKED_RETRY_DELAY_MS is 1000ms", () => {
		expect(SESSION_LOCKED_RETRY_DELAY_MS).toBe(1000);
	});

	test("SESSION_LOCKED_MAX_RETRIES is 3", () => {
		expect(SESSION_LOCKED_MAX_RETRIES).toBe(3);
	});
});

describe("promptOpenCode", () => {
	afterEach(() => {
		mockSessionCreate.mockClear();
		mockSessionPrompt.mockClear();
	});

	test("auto-creates session when botCtx.sessionID is null", async () => {
		const botCtx = new BotContext();
		const api = mockApi();
		const ensureSub = mock(() => {});

		await promptOpenCode(
			mockCtx(),
			[{ type: "text", text: "hello" }],
			botCtx,
			api,
			ensureSub,
		);

		// Wait for fire-and-forget prompt to complete
		await new Promise((r) => setTimeout(r, 50));

		expect(mockSessionCreate).toHaveBeenCalledTimes(1);
		expect(botCtx.sessionID).toBe("new-session-123");
		expect(mockSessionPrompt).toHaveBeenCalledTimes(1);
	});

	test("skips session creation when sessionID already exists", async () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "existing-session";
		const api = mockApi();
		const ensureSub = mock(() => {});

		await promptOpenCode(
			mockCtx(),
			[{ type: "text", text: "hello" }],
			botCtx,
			api,
			ensureSub,
		);

		await new Promise((r) => setTimeout(r, 50));

		expect(mockSessionCreate).not.toHaveBeenCalled();
		expect(mockSessionPrompt).toHaveBeenCalledTimes(1);
	});

	test("sends error notice when session creation fails", async () => {
		mockSessionCreate.mockImplementationOnce(() =>
			Promise.resolve({ data: null, error: "failed" }),
		);

		const botCtx = new BotContext();
		const ctx = mockCtx();
		const api = mockApi();
		const ensureSub = mock(() => {});

		await promptOpenCode(
			ctx,
			[{ type: "text", text: "hello" }],
			botCtx,
			api,
			ensureSub,
		);

		await new Promise((r) => setTimeout(r, 50));

		expect(botCtx.sessionID).toBeNull();
		expect(mockSessionPrompt).not.toHaveBeenCalled();
		// sendNotice sends via ctx.api.sendMessage
		const sendCalls = (ctx.api.sendMessage as ReturnType<typeof mock>).mock
			.calls;
		expect(sendCalls.length).toBeGreaterThanOrEqual(1);
	});

	test("retries on SessionLocked error", async () => {
		let callCount = 0;
		mockSessionPrompt.mockImplementation(() => {
			callCount++;
			if (callCount <= 2) {
				return Promise.resolve({
					error: { message: "SessionLocked: busy" },
				});
			}
			return Promise.resolve({ error: null });
		});

		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const api = mockApi();
		const ensureSub = mock(() => {});

		await promptOpenCode(
			mockCtx(),
			[{ type: "text", text: "hello" }],
			botCtx,
			api,
			ensureSub,
		);

		// Wait for retries (2 * 1000ms delay + margin)
		await new Promise((r) => setTimeout(r, 2500));

		// Should have been called 3 times: 2 failures + 1 success
		expect(callCount).toBe(3);
	});

	test("sends busy notice after exhausting SessionLocked retries", async () => {
		mockSessionPrompt.mockImplementation(() =>
			Promise.resolve({
				error: { message: "SessionLocked: still busy" },
			}),
		);

		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const api = mockApi();
		const ensureSub = mock(() => {});

		await promptOpenCode(
			mockCtx(),
			[{ type: "text", text: "hello" }],
			botCtx,
			api,
			ensureSub,
		);

		// Wait for all retries (3 * 1000ms + margin)
		await new Promise((r) => setTimeout(r, 4000));

		// Should have tried MAX_RETRIES + 1 times
		expect(mockSessionPrompt).toHaveBeenCalledTimes(
			SESSION_LOCKED_MAX_RETRIES + 1,
		);
		// Busy notice sent via botApi.sendMessage
		const sendCalls = (api.sendMessage as ReturnType<typeof mock>).mock.calls;
		expect(sendCalls.length).toBeGreaterThanOrEqual(1);
	});

	test("sends error notice on non-SessionLocked error", async () => {
		mockSessionPrompt.mockImplementationOnce(() =>
			Promise.resolve({
				error: { message: "Something went wrong" },
			}),
		);

		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const api = mockApi();
		const ensureSub = mock(() => {});

		await promptOpenCode(
			mockCtx(),
			[{ type: "text", text: "hello" }],
			botCtx,
			api,
			ensureSub,
		);

		await new Promise((r) => setTimeout(r, 50));

		// Should NOT retry — only one call
		expect(mockSessionPrompt).toHaveBeenCalledTimes(1);
		// Error notice sent via botApi
		const sendCalls = (api.sendMessage as ReturnType<typeof mock>).mock.calls;
		expect(sendCalls.length).toBeGreaterThanOrEqual(1);
	});

	test("does nothing when ctx.chat is missing", async () => {
		const botCtx = new BotContext();
		const api = mockApi();
		const ensureSub = mock(() => {});
		const ctx = { chat: undefined, api: mockApi() } as unknown as Context;

		await promptOpenCode(
			ctx,
			[{ type: "text", text: "hello" }],
			botCtx,
			api,
			ensureSub,
		);

		expect(ensureSub).not.toHaveBeenCalled();
		expect(mockSessionCreate).not.toHaveBeenCalled();
	});

	test("calls ensureSubscription with directory and chatId", async () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const api = mockApi();
		const ensureSub = mock(() => {});

		await promptOpenCode(
			mockCtx(42),
			[{ type: "text", text: "hello" }],
			botCtx,
			api,
			ensureSub,
		);

		expect(ensureSub).toHaveBeenCalledWith("/test/project", 42);
	});
});
