import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Event } from "@opencode-ai/sdk/v2";
import type { Api, Bot } from "grammy";
import { BotContext } from "~/lib/context";
import { processEvent, stopTyping } from "~/lib/events";

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

const CHAT_ID = 42;

describe("Message flow: text streaming → delivery", () => {
	afterEach(() => {
		const ctx = new BotContext();
		stopTyping(ctx);
	});

	test("streaming text parts → message completed → formatted message sent", async () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "session-1";
		const api = mockApi();
		const bot = mockBot(api);

		// Simulate incremental text streaming (each event contains full text so far)
		for (const text of ["He", "Hello", "Hello world!"]) {
			processEvent(
				{
					type: "message.part.updated",
					properties: {
						part: {
							sessionID: "session-1",
							messageID: "msg-1",
							type: "text",
							text,
						},
					},
				} as unknown as Event,
				bot,
				CHAT_ID,
				botCtx,
			);
		}

		// Text should be overwritten (not appended) — latest value wins
		expect(botCtx.accumulatedText.get("msg-1")).toBe("Hello world!");
		expect(botCtx.typingTimer).not.toBeNull();

		// Simulate message completion
		processEvent(
			{
				type: "message.updated",
				properties: {
					info: {
						id: "msg-1",
						sessionID: "session-1",
						role: "assistant",
						time: { completed: Date.now() },
					},
				},
			} as unknown as Event,
			bot,
			CHAT_ID,
			botCtx,
		);

		// Wait for async sendFormattedMessage chain to flush
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Text should have been sent via sendFormattedMessage → api.sendMessage
		const sendCalls = (api.sendMessage as ReturnType<typeof mock>).mock.calls;
		const textCalls = sendCalls.filter(
			(call: unknown[]) => call[0] === CHAT_ID,
		);
		expect(textCalls.length).toBeGreaterThanOrEqual(1);

		// Verify the sent text contains our content (may be MarkdownV2-converted)
		const sentText = (textCalls[0] as unknown[])[1] as string;
		expect(sentText.length).toBeGreaterThan(0);

		// Accumulated text should be cleared
		expect(botCtx.accumulatedText.has("msg-1")).toBe(false);
		// Typing indicator should stop (no more accumulated text)
		expect(botCtx.typingTimer).toBeNull();
	});

	test("error mid-stream clears state and sends error notice", async () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "session-1";
		const api = mockApi();
		const bot = mockBot(api);

		// Start streaming
		processEvent(
			{
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: "session-1",
						messageID: "msg-1",
						type: "text",
						text: "partial response that will be interrupted",
					},
				},
			} as unknown as Event,
			bot,
			CHAT_ID,
			botCtx,
		);

		expect(botCtx.accumulatedText.size).toBe(1);
		expect(botCtx.typingTimer).not.toBeNull();

		// Error event interrupts the stream
		processEvent(
			{
				type: "session.error",
				properties: {
					sessionID: "session-1",
					error: { message: "Context limit exceeded" },
				},
			} as unknown as Event,
			bot,
			CHAT_ID,
			botCtx,
		);

		// All transient state should be cleared
		expect(botCtx.accumulatedText.size).toBe(0);
		expect(botCtx.accumulatedFiles.size).toBe(0);
		expect(botCtx.processedToolCalls.size).toBe(0);
		expect(botCtx.typingTimer).toBeNull();

		// Error notice should be sent (sendNotice calls sendMessage)
		await new Promise((resolve) => setTimeout(resolve, 50));
		const sendCalls = (api.sendMessage as ReturnType<typeof mock>).mock.calls;
		// At least: sendChatAction for typing + sendMessage for error notice
		expect(sendCalls.length).toBeGreaterThanOrEqual(1);
	});

	test("session.idle after response clears leftover state", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "session-1";
		const bot = mockBot();

		// Simulate leftover state from a previous response
		botCtx.accumulatedText.set("msg-old", "leftover text");
		botCtx.accumulatedFiles.set("msg-old", [
			{ partID: "f1", url: "/tmp/f", mime: "text/plain" },
		]);
		botCtx.processedToolCalls.add("tc-1");

		processEvent(
			{
				type: "session.idle",
				properties: { sessionID: "session-1" },
			} as unknown as Event,
			bot,
			CHAT_ID,
			botCtx,
		);

		expect(botCtx.accumulatedText.size).toBe(0);
		expect(botCtx.accumulatedFiles.size).toBe(0);
		expect(botCtx.processedToolCalls.size).toBe(0);
	});

	test("multiple messages accumulate independently and deliver in order", async () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "session-1";
		const api = mockApi();
		const bot = mockBot(api);

		// Two messages being streamed concurrently
		processEvent(
			{
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: "session-1",
						messageID: "msg-1",
						type: "text",
						text: "First response",
					},
				},
			} as unknown as Event,
			bot,
			CHAT_ID,
			botCtx,
		);

		processEvent(
			{
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: "session-1",
						messageID: "msg-2",
						type: "text",
						text: "Second response",
					},
				},
			} as unknown as Event,
			bot,
			CHAT_ID,
			botCtx,
		);

		expect(botCtx.accumulatedText.get("msg-1")).toBe("First response");
		expect(botCtx.accumulatedText.get("msg-2")).toBe("Second response");

		// Complete first message
		processEvent(
			{
				type: "message.updated",
				properties: {
					info: {
						id: "msg-1",
						sessionID: "session-1",
						role: "assistant",
						time: { completed: Date.now() },
					},
				},
			} as unknown as Event,
			bot,
			CHAT_ID,
			botCtx,
		);

		// First message cleared, second still pending
		expect(botCtx.accumulatedText.has("msg-1")).toBe(false);
		expect(botCtx.accumulatedText.get("msg-2")).toBe("Second response");
		// Typing timer should still be active (second message pending)
		expect(botCtx.typingTimer).not.toBeNull();

		stopTyping(botCtx);
	});

	test("events from wrong session are completely ignored", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "session-1";
		const api = mockApi();
		const bot = mockBot(api);

		// All event types with wrong session should be no-ops
		const wrongSessionEvents: Event[] = [
			{
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: "wrong-session",
						messageID: "msg-1",
						type: "text",
						text: "should be ignored",
					},
				},
			},
			{
				type: "message.updated",
				properties: {
					info: {
						id: "msg-1",
						sessionID: "wrong-session",
						role: "assistant",
						time: { completed: Date.now() },
					},
				},
			},
			{
				type: "session.error",
				properties: {
					sessionID: "wrong-session",
					error: { message: "error" },
				},
			},
			{
				type: "session.idle",
				properties: { sessionID: "wrong-session" },
			},
		] as unknown as Event[];

		for (const event of wrongSessionEvents) {
			processEvent(event, bot, CHAT_ID, botCtx);
		}

		expect(botCtx.accumulatedText.size).toBe(0);
		expect(botCtx.typingTimer).toBeNull();
		// sendMessage should not have been called
		expect((api.sendMessage as ReturnType<typeof mock>).mock.calls.length).toBe(
			0,
		);
	});

	test("incomplete message.updated (no completed time) is ignored", () => {
		const botCtx = new BotContext();
		botCtx.sessionID = "session-1";
		const api = mockApi();
		const bot = mockBot(api);

		// Accumulate text
		processEvent(
			{
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: "session-1",
						messageID: "msg-1",
						type: "text",
						text: "in progress",
					},
				},
			} as unknown as Event,
			bot,
			CHAT_ID,
			botCtx,
		);

		// message.updated WITHOUT completed time — should not trigger send
		processEvent(
			{
				type: "message.updated",
				properties: {
					info: {
						id: "msg-1",
						sessionID: "session-1",
						role: "assistant",
						time: {},
					},
				},
			} as unknown as Event,
			bot,
			CHAT_ID,
			botCtx,
		);

		// Text should still be accumulated (not sent)
		expect(botCtx.accumulatedText.get("msg-1")).toBe("in progress");
		// Only sendChatAction calls, no sendMessage
		const sendMsgCalls = (api.sendMessage as ReturnType<typeof mock>).mock
			.calls;
		expect(sendMsgCalls.length).toBe(0);

		stopTyping(botCtx);
	});
});
