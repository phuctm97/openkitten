import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Api, Bot } from "grammy";
import { BotContext } from "~/lib/context";

// biome-ignore lint: mock return types are intentionally loose for test flexibility
const mockSessionCreate = mock(
	(): Promise<unknown> =>
		Promise.resolve({ data: { id: "new-session-id" }, error: null }),
);
// biome-ignore lint: mock return types are intentionally loose for test flexibility
const mockSessionAbort = mock(
	(): Promise<unknown> => Promise.resolve({ error: null }),
);

mock.module("~/lib/opencode", () => ({
	getClient: () => ({
		session: { create: mockSessionCreate, abort: mockSessionAbort },
	}),
	getDirectory: () => "/test/project",
}));

import { registerCommands } from "~/lib/commands";

function mockApi(): Api {
	return {
		sendChatAction: mock(() => Promise.resolve(true)),
		sendMessage: mock(() =>
			Promise.resolve({ message_id: 1, date: 0, chat: { id: 1 } }),
		),
	} as unknown as Api;
}

type CommandHandler = (ctx: {
	chat: { id: number };
	api: Api;
}) => Promise<void> | void;

function captureHandlers() {
	const handlers = new Map<string, CommandHandler>();
	const bot = {
		command: (name: string, handler: CommandHandler) =>
			handlers.set(name, handler),
	} as unknown as Bot;
	return { bot, handlers };
}

describe("registerCommands", () => {
	afterEach(() => {
		mockSessionCreate.mockReset();
		mockSessionAbort.mockReset();
		mockSessionCreate.mockImplementation(() =>
			Promise.resolve({ data: { id: "new-session-id" }, error: null }),
		);
		mockSessionAbort.mockImplementation(() => Promise.resolve({ error: null }));
	});

	test("/start creates a new session", async () => {
		const botCtx = new BotContext();
		const ensureSub = mock(() => {});
		const { bot, handlers } = captureHandlers();

		registerCommands(bot, botCtx, ensureSub);

		const api = mockApi();
		await handlers.get("start")!({ chat: { id: 42 }, api });

		expect(mockSessionCreate).toHaveBeenCalledTimes(1);
		expect(botCtx.sessionID).toBe("new-session-id");
	});

	test("/start calls ensureSubscription", async () => {
		const botCtx = new BotContext();
		const ensureSub = mock(() => {});
		const { bot, handlers } = captureHandlers();

		registerCommands(bot, botCtx, ensureSub);

		const api = mockApi();
		await handlers.get("start")!({ chat: { id: 42 }, api });

		expect(ensureSub).toHaveBeenCalledWith("/test/project", 42);
	});

	test("/start clears transient state but preserves eventChatId", async () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "old-session";
		botCtx.eventChatId = 42;
		botCtx.accumulatedText.set("m1", "stale");
		const ensureSub = mock(() => {});
		const { bot, handlers } = captureHandlers();

		registerCommands(bot, botCtx, ensureSub);

		const api = mockApi();
		await handlers.get("start")!({ chat: { id: 42 }, api });

		// Transient state cleared
		expect(botCtx.accumulatedText.size).toBe(0);
		// New session set
		expect(botCtx.sessionID).toBe("new-session-id");
		// eventChatId preserved (routing state, not message state)
		expect(botCtx.eventChatId).toBe(42);
	});

	test("/start sends error notice on session creation failure", async () => {
		mockSessionCreate.mockImplementationOnce(() =>
			Promise.resolve({ data: null, error: "creation failed" }),
		);

		const botCtx = new BotContext();
		const ensureSub = mock(() => {});
		const { bot, handlers } = captureHandlers();

		registerCommands(bot, botCtx, ensureSub);

		const api = mockApi();
		await handlers.get("start")!({ chat: { id: 42 }, api });

		expect(botCtx.sessionID).toBeNull();
		const sendCalls = (api.sendMessage as ReturnType<typeof mock>).mock.calls;
		expect(sendCalls.length).toBeGreaterThanOrEqual(1);
	});

	test("/stop aborts request but preserves session", async () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "active-session";
		botCtx.accumulatedText.set("m1", "in-flight");
		const ensureSub = mock(() => {});
		const { bot, handlers } = captureHandlers();

		registerCommands(bot, botCtx, ensureSub);

		const api = mockApi();
		await handlers.get("stop")!({ chat: { id: 42 }, api });

		expect(mockSessionAbort).toHaveBeenCalledTimes(1);
		// Transient state cleared
		expect(botCtx.accumulatedText.size).toBe(0);
		// Session preserved — /stop aborts the request, not the session
		expect(botCtx.sessionID).toBe("active-session");
	});

	test("/stop sends error notice when no session", async () => {
		const botCtx = new BotContext();
		const ensureSub = mock(() => {});
		const { bot, handlers } = captureHandlers();

		registerCommands(bot, botCtx, ensureSub);

		const api = mockApi();
		await handlers.get("stop")!({ chat: { id: 42 }, api });

		expect(mockSessionAbort).not.toHaveBeenCalled();
		const sendCalls = (api.sendMessage as ReturnType<typeof mock>).mock.calls;
		expect(sendCalls.length).toBeGreaterThanOrEqual(1);
	});

	test("/help sends help message", () => {
		const botCtx = new BotContext();
		const ensureSub = mock(() => {});
		const { bot, handlers } = captureHandlers();

		registerCommands(bot, botCtx, ensureSub);

		const api = mockApi();
		handlers.get("help")!({ chat: { id: 42 }, api });

		const sendCalls = (api.sendMessage as ReturnType<typeof mock>).mock.calls;
		expect(sendCalls.length).toBeGreaterThanOrEqual(1);
	});
});
