import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Event } from "@opencode-ai/sdk/v2";
import type { Api, Bot } from "grammy";
import { BotContext } from "~/lib/context";
import { processEvent, startTyping, stopTyping } from "~/lib/events";

function mockApi(): Api {
	return {
		sendChatAction: mock(() => Promise.resolve(true)),
		sendMessage: mock(() =>
			Promise.resolve({ message_id: 1, date: 0, chat: { id: 1 } }),
		),
	} as unknown as Api;
}

function mockBot(api?: Api): Bot {
	const a = api ?? mockApi();
	return { api: a } as unknown as Bot;
}

describe("startTyping / stopTyping", () => {
	let botCtx: BotContext;

	afterEach(() => {
		stopTyping(botCtx);
	});

	test("startTyping sets timer on BotContext", () => {
		botCtx = new BotContext();
		const api = mockApi();
		startTyping(botCtx, api, 123);
		expect(botCtx.typingTimer).not.toBeNull();
		// Sends immediately on start
		expect(api.sendChatAction).toHaveBeenCalledTimes(1);
		stopTyping(botCtx);
	});

	test("startTyping is idempotent when already typing", () => {
		botCtx = new BotContext();
		const api = mockApi();
		startTyping(botCtx, api, 123);
		const timer1 = botCtx.typingTimer;
		startTyping(botCtx, api, 123);
		expect(botCtx.typingTimer).toBe(timer1);
		stopTyping(botCtx);
	});

	test("stopTyping clears timer", () => {
		botCtx = new BotContext();
		const api = mockApi();
		startTyping(botCtx, api, 123);
		expect(botCtx.typingTimer).not.toBeNull();
		stopTyping(botCtx);
		expect(botCtx.typingTimer).toBeNull();
	});

	test("stopTyping is safe when no timer", () => {
		botCtx = new BotContext();
		expect(() => stopTyping(botCtx)).not.toThrow();
	});
});

describe("processEvent", () => {
	test("ignores events when no sessionID", () => {
		const botCtx = new BotContext();
		const bot = mockBot();
		const event: Event = {
			type: "message.part.updated",
			properties: {
				part: { sessionID: "s1", messageID: "m1", type: "text", text: "hi" },
			},
		} as unknown as Event;

		processEvent(event, bot, 123, botCtx);
		expect(botCtx.accumulatedText.size).toBe(0);
	});

	test("ignores events for wrong session", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "correct-session";
		const bot = mockBot();
		const event: Event = {
			type: "message.part.updated",
			properties: {
				part: {
					sessionID: "wrong-session",
					messageID: "m1",
					type: "text",
					text: "hi",
				},
			},
		} as unknown as Event;

		processEvent(event, bot, 123, botCtx);
		expect(botCtx.accumulatedText.size).toBe(0);
	});

	test("accumulates text on message.part.updated", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const api = mockApi();
		const bot = mockBot(api);

		const event: Event = {
			type: "message.part.updated",
			properties: {
				part: { sessionID: "s1", messageID: "m1", type: "text", text: "hello" },
			},
		} as unknown as Event;

		processEvent(event, bot, 123, botCtx);
		expect(botCtx.accumulatedText.get("m1")).toBe("hello");
		expect(botCtx.typingTimer).not.toBeNull();
		stopTyping(botCtx);
	});

	test("overwrites text on subsequent updates (same messageID)", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const bot = mockBot();

		const event1: Event = {
			type: "message.part.updated",
			properties: {
				part: {
					sessionID: "s1",
					messageID: "m1",
					type: "text",
					text: "hello",
				},
			},
		} as unknown as Event;
		const event2: Event = {
			type: "message.part.updated",
			properties: {
				part: {
					sessionID: "s1",
					messageID: "m1",
					type: "text",
					text: "hello world",
				},
			},
		} as unknown as Event;

		processEvent(event1, bot, 123, botCtx);
		processEvent(event2, bot, 123, botCtx);
		expect(botCtx.accumulatedText.get("m1")).toBe("hello world");
		stopTyping(botCtx);
	});

	test("accumulates files on message.part.updated", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const bot = mockBot();

		const event: Event = {
			type: "message.part.updated",
			properties: {
				part: {
					sessionID: "s1",
					messageID: "m1",
					type: "file",
					id: "f1",
					url: "http://example.com/file.png",
					mime: "image/png",
					filename: "file.png",
				},
			},
		} as unknown as Event;

		processEvent(event, bot, 123, botCtx);
		const files = botCtx.accumulatedFiles.get("m1");
		expect(files).toHaveLength(1);
		expect(files![0]!.partID).toBe("f1");
		stopTyping(botCtx);
	});

	test("updates existing file part with same partID", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const bot = mockBot();

		// First file part
		processEvent(
			{
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: "s1",
						messageID: "m1",
						type: "file",
						id: "f1",
						url: "http://example.com/v1.png",
						mime: "image/png",
						filename: "v1.png",
					},
				},
			} as unknown as Event,
			bot,
			123,
			botCtx,
		);

		// Updated file part with same partID
		processEvent(
			{
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: "s1",
						messageID: "m1",
						type: "file",
						id: "f1",
						url: "http://example.com/v2.png",
						mime: "image/png",
						filename: "v2.png",
					},
				},
			} as unknown as Event,
			bot,
			123,
			botCtx,
		);

		const files = botCtx.accumulatedFiles.get("m1");
		expect(files).toHaveLength(1);
		expect(files?.[0]?.url).toBe("http://example.com/v2.png");
		stopTyping(botCtx);
	});

	test("handles attach_file tool call", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const bot = mockBot();

		processEvent(
			{
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: "s1",
						messageID: "m1",
						type: "tool",
						callID: "tc1",
						tool: "attach_file",
						state: {
							status: "completed",
							input: { path: "/tmp/test.png", caption: "A file" },
						},
					},
				},
			} as unknown as Event,
			bot,
			123,
			botCtx,
		);

		const files = botCtx.accumulatedFiles.get("m1");
		expect(files).toHaveLength(1);
		expect(files?.[0]?.partID).toBe("tc1");
		expect(files?.[0]?.caption).toBe("A file");
		// Tool call should be marked as processed
		expect(botCtx.processedToolCalls.has("tc1")).toBe(true);
	});

	test("attach_file deduplicates by callID", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const bot = mockBot();

		const event = {
			type: "message.part.updated",
			properties: {
				part: {
					sessionID: "s1",
					messageID: "m1",
					type: "tool",
					callID: "tc1",
					tool: "attach_file",
					state: {
						status: "completed",
						input: { path: "/tmp/test.png" },
					},
				},
			},
		} as unknown as Event;

		processEvent(event, bot, 123, botCtx);
		processEvent(event, bot, 123, botCtx);

		const files = botCtx.accumulatedFiles.get("m1");
		expect(files).toHaveLength(1);
	});

	test("ignores non-attach_file tool calls", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const bot = mockBot();

		processEvent(
			{
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: "s1",
						messageID: "m1",
						type: "tool",
						callID: "tc1",
						tool: "some_other_tool",
						state: {
							status: "completed",
							input: { path: "/tmp/test.png" },
						},
					},
				},
			} as unknown as Event,
			bot,
			123,
			botCtx,
		);

		expect(botCtx.accumulatedFiles.has("m1")).toBe(false);
	});

	test("ignores incomplete attach_file tool calls", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const bot = mockBot();

		processEvent(
			{
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: "s1",
						messageID: "m1",
						type: "tool",
						callID: "tc1",
						tool: "attach_file",
						state: {
							status: "running",
							input: { path: "/tmp/test.png" },
						},
					},
				},
			} as unknown as Event,
			bot,
			123,
			botCtx,
		);

		expect(botCtx.accumulatedFiles.has("m1")).toBe(false);
		expect(botCtx.processedToolCalls.has("tc1")).toBe(false);
	});

	test("clears state on session.error", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		botCtx.accumulatedText.set("m1", "hello");
		botCtx.processedToolCalls.add("tc1");
		const api = mockApi();
		const bot = mockBot(api);

		const event: Event = {
			type: "session.error",
			properties: {
				sessionID: "s1",
				error: { message: "Something failed" },
			},
		} as unknown as Event;

		processEvent(event, bot, 123, botCtx);
		expect(botCtx.accumulatedText.size).toBe(0);
		expect(botCtx.processedToolCalls.size).toBe(0);
		expect(api.sendMessage).toHaveBeenCalledTimes(1);
	});

	test("clears state on session.idle", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		botCtx.accumulatedText.set("m1", "hello");
		botCtx.accumulatedFiles.set("m1", [
			{ partID: "f1", url: "/tmp/f", mime: "text/plain" },
		]);
		const bot = mockBot();

		const event: Event = {
			type: "session.idle",
			properties: { sessionID: "s1" },
		} as unknown as Event;

		processEvent(event, bot, 123, botCtx);
		expect(botCtx.accumulatedText.size).toBe(0);
		expect(botCtx.accumulatedFiles.size).toBe(0);
	});

	test("renders permission keyboard on permission.asked", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const api = mockApi();
		const bot = mockBot(api);

		const event: Event = {
			type: "permission.asked",
			properties: {
				id: "perm1",
				sessionID: "s1",
				permission: "file:read",
				patterns: ["/etc/*"],
			},
		} as unknown as Event;

		processEvent(event, bot, 123, botCtx);
		expect(api.sendMessage).toHaveBeenCalledTimes(1);
		const calls = (api.sendMessage as ReturnType<typeof mock>).mock.calls;
		const call = calls[0] as unknown[];
		expect(call[0]).toBe(123); // chatId
		// Message should contain "Permission"
		expect(call[1]).toContain("Permission");
	});

	test("initializes question state on question.asked", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "s1";
		const api = mockApi();
		const bot = mockBot(api);

		const event: Event = {
			type: "question.asked",
			properties: {
				id: "q1",
				sessionID: "s1",
				questions: [
					{
						header: "Test",
						question: "Pick one?",
						options: [
							{ label: "A", description: "Option A" },
							{ label: "B", description: "Option B" },
						],
					},
				],
			},
		} as unknown as Event;

		processEvent(event, bot, 123, botCtx);
		expect(botCtx.questionState).not.toBeNull();
		expect(botCtx.questionState!.requestID).toBe("q1");
		expect(botCtx.questionState!.questions).toHaveLength(1);
		// showQuestion should have been called (sendMessage)
		expect(api.sendMessage).toHaveBeenCalledTimes(1);
	});
});
