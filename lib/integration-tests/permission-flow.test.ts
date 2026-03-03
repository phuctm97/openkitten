import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Event } from "@opencode-ai/sdk/v2";
import type { Api, Bot, Context } from "grammy";

// Mock opencode module — Bun hoists mock.module before imports
const mockPermissionReply = mock(() => Promise.resolve({ error: null }));
const mockQuestionReply = mock(() => Promise.resolve({ error: null }));

mock.module("~/lib/opencode", () => ({
	getClient: () => ({
		permission: { reply: mockPermissionReply },
		question: { reply: mockQuestionReply },
		session: {
			create: mock(() => Promise.resolve({ data: { id: "s1" }, error: null })),
			prompt: mock(() => Promise.resolve({ error: null })),
		},
	}),
	getDirectory: () => "/test/project",
	initClient: () => {},
	initDirectory: () => Promise.resolve("/test/project"),
	subscribeToEvents: () => Promise.resolve(),
	stopEventListening: () => {},
	getReconnectDelay: (attempt: number) =>
		Math.min(1000 * 2 ** Math.max(0, attempt - 1), 15000),
}));

import { BotContext } from "~/lib/context";
import { processEvent, stopTyping } from "~/lib/events";
import { handleCallbackQuery } from "~/lib/handlers";

function mockApi(sendMessageId = 42): Api {
	return {
		sendChatAction: mock(() => Promise.resolve(true)),
		sendMessage: mock(() =>
			Promise.resolve({
				message_id: sendMessageId,
				date: 0,
				chat: { id: 1 },
			}),
		),
	} as unknown as Api;
}

function mockBot(api?: Api): Bot {
	const a = api ?? mockApi();
	return { api: a } as unknown as Bot;
}

function mockGrammyContext(overrides: Record<string, unknown> = {}): Context {
	return {
		callbackQuery: undefined,
		chat: { id: 123 },
		message: undefined,
		api: {
			sendChatAction: mock(() => Promise.resolve(true)),
			sendMessage: mock(() =>
				Promise.resolve({ message_id: 1, date: 0, chat: { id: 1 } }),
			),
			editMessageText: mock(() => Promise.resolve(true)),
		},
		answerCallbackQuery: mock(() => Promise.resolve(true)),
		editMessageText: mock(() => Promise.resolve(true)),
		deleteMessage: mock(() => Promise.resolve(true)),
		...overrides,
	} as unknown as Context;
}

const CHAT_ID = 123;

describe("Permission flow: event → keyboard → reply", () => {
	afterEach(() => {
		mockPermissionReply.mockClear();
		mockQuestionReply.mockClear();
	});

	test("full allow-once flow: permission.asked → keyboard → Allow Once → reply sent", async () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "session-1";
		const permMessageId = 99;
		const api = mockApi(permMessageId);
		const bot = mockBot(api);

		// Step 1: permission.asked event arrives via SSE
		processEvent(
			{
				type: "permission.asked",
				properties: {
					id: "perm-req-1",
					sessionID: "session-1",
					permission: "file:write",
					patterns: ["/home/user/*"],
				},
			} as unknown as Event,
			bot,
			CHAT_ID,
			botCtx,
		);

		// Wait for the sendMessage promise chain
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Keyboard was sent to Telegram
		const sendCalls = (api.sendMessage as ReturnType<typeof mock>).mock.calls;
		expect(sendCalls.length).toBe(1);
		const call = sendCalls[0] as unknown[];
		expect(call[0]).toBe(CHAT_ID);
		expect(call[1]).toContain("Permission");
		expect(call[1]).toContain("file:write");
		expect((call[2] as Record<string, unknown>).reply_markup).toBeTruthy();

		// Pending permission was stored in BotContext
		expect(botCtx.pendingPermissions.has(permMessageId)).toBe(true);
		expect(botCtx.pendingPermissions.get(permMessageId)!.requestID).toBe(
			"perm-req-1",
		);

		// Step 2: User clicks "Allow Once"
		const ctx = mockGrammyContext({
			callbackQuery: {
				data: "permission:once",
				message: { message_id: permMessageId },
			},
		});

		await handleCallbackQuery(ctx, botCtx);

		// Callback was answered
		expect(ctx.answerCallbackQuery).toHaveBeenCalled();
		// Permission message was deleted
		expect(ctx.deleteMessage).toHaveBeenCalled();
		// Permission reply was sent to OpenCode
		expect(mockPermissionReply).toHaveBeenCalledTimes(1);
		const replyArgs = mockPermissionReply.mock.calls[0] as unknown[];
		const replyPayload = replyArgs[0] as Record<string, unknown>;
		expect(replyPayload.requestID).toBe("perm-req-1");
		expect(replyPayload.reply).toBe("once");
		expect(replyPayload.directory).toBe("/test/project");
		// Pending permission was cleaned up
		expect(botCtx.pendingPermissions.has(permMessageId)).toBe(false);
	});

	test("full deny flow: permission.asked → keyboard → Deny → reject sent", async () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "session-1";
		const permMessageId = 77;
		const api = mockApi(permMessageId);
		const bot = mockBot(api);

		processEvent(
			{
				type: "permission.asked",
				properties: {
					id: "perm-req-2",
					sessionID: "session-1",
					permission: "command:run",
					patterns: ["rm -rf *"],
				},
			} as unknown as Event,
			bot,
			CHAT_ID,
			botCtx,
		);

		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(botCtx.pendingPermissions.has(permMessageId)).toBe(true);

		// User clicks "Deny"
		const ctx = mockGrammyContext({
			callbackQuery: {
				data: "permission:reject",
				message: { message_id: permMessageId },
			},
		});

		await handleCallbackQuery(ctx, botCtx);

		expect(mockPermissionReply).toHaveBeenCalledTimes(1);
		const replyArgs = mockPermissionReply.mock.calls[0] as unknown[];
		const replyPayload = replyArgs[0] as Record<string, unknown>;
		expect(replyPayload.reply).toBe("reject");
		expect(botCtx.pendingPermissions.has(permMessageId)).toBe(false);
	});

	test("always-allow flow: permission.asked → keyboard → Always Allow → always sent", async () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "session-1";
		const permMessageId = 55;
		const api = mockApi(permMessageId);
		const bot = mockBot(api);

		processEvent(
			{
				type: "permission.asked",
				properties: {
					id: "perm-req-3",
					sessionID: "session-1",
					permission: "file:read",
					patterns: [],
				},
			} as unknown as Event,
			bot,
			CHAT_ID,
			botCtx,
		);

		await new Promise((resolve) => setTimeout(resolve, 50));

		const ctx = mockGrammyContext({
			callbackQuery: {
				data: "permission:always",
				message: { message_id: permMessageId },
			},
		});

		await handleCallbackQuery(ctx, botCtx);

		expect(mockPermissionReply).toHaveBeenCalledTimes(1);
		const replyArgs = mockPermissionReply.mock.calls[0] as unknown[];
		const replyPayload = replyArgs[0] as Record<string, unknown>;
		expect(replyPayload.reply).toBe("always");
		expect(botCtx.pendingPermissions.size).toBe(0);
	});

	test("expired permission shows alert without sending reply", async () => {
		const botCtx = new BotContext();
		// No pending permissions stored

		const ctx = mockGrammyContext({
			callbackQuery: {
				data: "permission:once",
				message: { message_id: 999 },
			},
		});

		await handleCallbackQuery(ctx, botCtx);

		expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
			text: "Permission request expired",
			show_alert: true,
		});
		expect(mockPermissionReply).not.toHaveBeenCalled();
	});

	test("BotContext isolation: permissions from one context don't leak", async () => {
		const botCtx1 = new BotContext();
		botCtx1.sessionID = "s1";
		const botCtx2 = new BotContext();
		botCtx2.sessionID = "s2";

		const permMessageId = 50;
		const api = mockApi(permMessageId);
		const bot = mockBot(api);

		// Send permission to botCtx1
		processEvent(
			{
				type: "permission.asked",
				properties: {
					id: "perm-1",
					sessionID: "s1",
					permission: "file:read",
					patterns: [],
				},
			} as unknown as Event,
			bot,
			CHAT_ID,
			botCtx1,
		);

		await new Promise((resolve) => setTimeout(resolve, 50));

		// botCtx1 has the permission, botCtx2 does not
		expect(botCtx1.pendingPermissions.size).toBe(1);
		expect(botCtx2.pendingPermissions.size).toBe(0);

		// Trying to handle callback with botCtx2 should fail (no pending permission)
		const ctx = mockGrammyContext({
			callbackQuery: {
				data: "permission:once",
				message: { message_id: permMessageId },
			},
		});

		await handleCallbackQuery(ctx, botCtx2);

		// Should get "expired" since botCtx2 doesn't have this permission
		expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
			text: "Permission request expired",
			show_alert: true,
		});
		expect(mockPermissionReply).not.toHaveBeenCalled();

		// botCtx1 still has its permission
		expect(botCtx1.pendingPermissions.size).toBe(1);

		stopTyping(botCtx1);
		stopTyping(botCtx2);
	});
});
