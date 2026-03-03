import { describe, expect, test } from "bun:test";
import { BotContext } from "~/lib/context";

describe("BotContext", () => {
	test("fresh instance has empty state", () => {
		const ctx = new BotContext();
		expect(ctx.accumulatedText.size).toBe(0);
		expect(ctx.accumulatedFiles.size).toBe(0);
		expect(ctx.pendingPermissions.size).toBe(0);
		expect(ctx.processedToolCalls.size).toBe(0);
		expect(ctx.questionState).toBeNull();
		expect(ctx.sessionID).toBeNull();
		expect(ctx.eventChatId).toBeNull();
		expect(ctx.typingTimer).toBeNull();
	});

	test("resetTransient clears transient state but keeps sessionID and eventChatId", () => {
		const ctx = new BotContext();
		ctx.sessionID = "test-session-123";
		ctx.accumulatedText.set("msg1", "hello");
		ctx.accumulatedFiles.set("msg1", [
			{ partID: "p1", url: "/tmp/file", mime: "text/plain" },
		]);
		ctx.pendingPermissions.set(1, {
			requestID: "req1",
			messageId: 1,
		});
		ctx.processedToolCalls.add("call1");
		ctx.questionState = {
			requestID: "q1",
			questions: [],
			currentIndex: 0,
			answers: [],
			selectedOptions: new Map(),
			customAnswers: new Map(),
			activeMessageId: null,
		};
		ctx.eventChatId = 12345;

		ctx.resetTransient();

		expect(ctx.accumulatedText.size).toBe(0);
		expect(ctx.accumulatedFiles.size).toBe(0);
		expect(ctx.pendingPermissions.size).toBe(0);
		expect(ctx.processedToolCalls.size).toBe(0);
		expect(ctx.questionState).toBeNull();
		expect(ctx.typingTimer).toBeNull();
		// sessionID and eventChatId preserved — they're routing state, not message state
		expect(ctx.sessionID).toBe("test-session-123");
		expect(ctx.eventChatId).toBe(12345);
	});

	test("resetAll clears everything including sessionID and eventChatId", () => {
		const ctx = new BotContext();
		ctx.sessionID = "test-session-456";
		ctx.accumulatedText.set("msg1", "hello");
		ctx.eventChatId = 99;

		ctx.resetAll();

		expect(ctx.sessionID).toBeNull();
		expect(ctx.accumulatedText.size).toBe(0);
		expect(ctx.eventChatId).toBeNull();
	});

	test("resetTransient clears typing timer", () => {
		const ctx = new BotContext();
		ctx.typingTimer = setInterval(() => {}, 1000);

		ctx.resetTransient();

		expect(ctx.typingTimer).toBeNull();
	});

	test("separate instances are isolated", () => {
		const ctx1 = new BotContext();
		const ctx2 = new BotContext();

		ctx1.accumulatedText.set("msg1", "from ctx1");
		ctx1.sessionID = "session-1";

		expect(ctx2.accumulatedText.size).toBe(0);
		expect(ctx2.sessionID).toBeNull();
	});
});
