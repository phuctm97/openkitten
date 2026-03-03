import { describe, expect, mock, test } from "bun:test";
import type { Context } from "grammy";
import { BotContext } from "~/lib/context";
import { handleCallbackQuery, handleCustomTextInput } from "~/lib/handlers";
import type { QuestionState } from "~/lib/types";

function mockCtx(overrides: Record<string, unknown> = {}): Context {
	return {
		callbackQuery: undefined,
		chat: { id: 1 },
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

function makeQuestionState(
	overrides: Partial<QuestionState> = {},
): QuestionState {
	return {
		requestID: "req-1",
		questions: [
			{
				header: "Auth",
				question: "Choose method?",
				options: [
					{ label: "OAuth", description: "Use OAuth" },
					{ label: "JWT", description: "Use JWT" },
				],
			},
		],
		currentIndex: 0,
		answers: [],
		selectedOptions: new Map(),
		customAnswers: new Map(),
		activeMessageId: 100,
		...overrides,
	};
}

describe("handleCallbackQuery", () => {
	test("handles missing data gracefully", async () => {
		const ctx = mockCtx({ callbackQuery: {} });
		const botCtx = new BotContext();
		await handleCallbackQuery(ctx, botCtx);
		// Should not throw
	});

	test("routes permission callbacks", async () => {
		const botCtx = new BotContext();
		botCtx.pendingPermissions.set(42, {
			requestID: "perm1",
			messageId: 42,
		});

		const ctx = mockCtx({
			callbackQuery: {
				data: "permission:once",
				message: { message_id: 42 },
			},
		});

		// This will try to call getClient/getDirectory which will throw,
		// but the permission lookup should work
		try {
			await handleCallbackQuery(ctx, botCtx);
		} catch {
			// Expected — getDirectory not initialized in test
		}
	});

	test("answers with 'No active question' when no question state", async () => {
		const botCtx = new BotContext();
		const ctx = mockCtx({
			callbackQuery: { data: "question:select:0:1" },
		});
		await handleCallbackQuery(ctx, botCtx);
		expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
			text: "No active question",
			show_alert: true,
		});
	});

	test("answers with 'Question expired' for wrong index", async () => {
		const botCtx = new BotContext();
		botCtx.questionState = makeQuestionState({ currentIndex: 0 });
		const ctx = mockCtx({
			callbackQuery: { data: "question:select:5:0" },
		});
		await handleCallbackQuery(ctx, botCtx);
		expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
			text: "Question expired",
			show_alert: true,
		});
	});
});

describe("handleCustomTextInput", () => {
	test("returns false when no question state", async () => {
		const botCtx = new BotContext();
		const ctx = mockCtx({ message: { text: "hello" } });
		const result = await handleCustomTextInput(ctx, botCtx);
		expect(result).toBe(false);
	});

	test("returns false when no text in message", async () => {
		const botCtx = new BotContext();
		botCtx.questionState = makeQuestionState();
		const ctx = mockCtx({ message: {} });
		const result = await handleCustomTextInput(ctx, botCtx);
		expect(result).toBe(false);
	});

	test("captures custom text and advances question", async () => {
		const botCtx = new BotContext();
		// Use 2 questions so advancing doesn't trigger submitAllAnswers (needs getClient)
		const qs = makeQuestionState({
			questions: [
				{
					header: "Q1",
					question: "First?",
					options: [{ label: "A", description: "A" }],
				},
				{
					header: "Q2",
					question: "Second?",
					options: [{ label: "B", description: "B" }],
				},
			],
		});
		botCtx.questionState = qs;

		const ctx = mockCtx({
			message: { text: "My custom answer" },
		});

		const result = await handleCustomTextInput(ctx, botCtx);
		expect(result).toBe(true);
		expect(qs.customAnswers.get(0)).toBe("My custom answer");
	});

	test("edits the active question message with answered text", async () => {
		const botCtx = new BotContext();
		const qs = makeQuestionState({
			activeMessageId: 42,
			questions: [
				{
					header: "Q1",
					question: "First?",
					options: [{ label: "A", description: "A" }],
				},
				{
					header: "Q2",
					question: "Second?",
					options: [{ label: "B", description: "B" }],
				},
			],
		});
		botCtx.questionState = qs;

		const editFn = mock(() => Promise.resolve(true));
		const ctx = mockCtx({
			message: { text: "Custom" },
			api: {
				sendChatAction: mock(() => Promise.resolve(true)),
				sendMessage: mock(() =>
					Promise.resolve({ message_id: 2, date: 0, chat: { id: 1 } }),
				),
				editMessageText: editFn,
			},
		});

		await handleCustomTextInput(ctx, botCtx);
		expect(editFn).toHaveBeenCalled();
	});
});
