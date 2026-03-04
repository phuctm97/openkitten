import { describe, expect, it } from "bun:test";
import {
	executeCallbackEffects,
	executeEffects,
} from "~/lib/core/effect-executor";
import { createSessionState } from "~/lib/core/session-state";
import type {
	CallbackEffect,
	Effect,
	QuestionState,
	SessionState,
} from "~/lib/core/types";
import { createFileSystemStub } from "~/test/stubs/filesystem";
import { createOpenCodeStub } from "~/test/stubs/opencode";
import { createTelegramStub } from "~/test/stubs/telegram";
import { createTimerStub } from "~/test/stubs/timer";

function makeDeps(state?: SessionState) {
	const telegram = createTelegramStub();
	const opencode = createOpenCodeStub();
	const timer = createTimerStub();
	const fs = createFileSystemStub();
	const s = state ?? createSessionState();

	return {
		deps: {
			telegram,
			opencode,
			timer,
			fs,
			chatId: 123,
			directory: "/test",
			state: s,
		},
		telegram,
		opencode,
		timer,
		fs,
		state: s,
	};
}

describe("executeEffects", () => {
	it("executes start_typing — sets timer handle", async () => {
		const { deps, timer, state } = makeDeps();

		await executeEffects([{ type: "start_typing" }], deps);

		expect(state.typingHandle).not.toBeNull();
		expect(timer.registrations.length).toBe(1);
		expect(timer.registrations[0]?.ms).toBe(4000);
	});

	it("start_typing is no-op when already typing", async () => {
		const { deps, timer, state } = makeDeps();
		state.typingHandle = "existing";

		await executeEffects([{ type: "start_typing" }], deps);

		// Should not create another interval
		expect(timer.registrations.length).toBe(0);
		expect(state.typingHandle).toBe("existing");
	});

	it("executes stop_typing — clears timer handle", async () => {
		const { deps, timer, state } = makeDeps();

		// Start first
		await executeEffects([{ type: "start_typing" }], deps);
		expect(state.typingHandle).not.toBeNull();

		// Stop
		await executeEffects([{ type: "stop_typing" }], deps);
		expect(state.typingHandle).toBeNull();
		expect(timer.registrations[0]?.cleared).toBe(true);
	});

	it("stop_typing is no-op when not typing", async () => {
		const { deps, state } = makeDeps();
		await executeEffects([{ type: "stop_typing" }], deps);
		expect(state.typingHandle).toBeNull();
	});

	it("executes reset_state", async () => {
		const state = createSessionState();
		state.accumulatedText.set("a", "b");
		state.pendingPermissions.set(1, { requestID: "r", messageId: 1 });

		const { deps } = makeDeps(state);
		await executeEffects([{ type: "reset_state" }], deps);

		expect(state.accumulatedText.size).toBe(0);
		expect(state.pendingPermissions.size).toBe(0);
	});

	it("executes send_formatted_message — sends to telegram", async () => {
		const { deps, telegram } = makeDeps();

		await executeEffects(
			[{ type: "send_formatted_message", text: "Hello" }],
			deps,
		);

		expect(telegram.calls.some((c) => c.method === "sendMessage")).toBe(true);
	});

	it("executes send_notice", async () => {
		const { deps, telegram } = makeDeps();

		await executeEffects(
			[{ type: "send_notice", kind: "started", message: "New session." }],
			deps,
		);

		const call = telegram.calls.find((c) => c.method === "sendMessage");
		expect(call).toBeDefined();
		// Should include disable_notification
		const opts = call?.args[2] as { disable_notification?: boolean };
		expect(opts.disable_notification).toBe(true);
	});

	it("executes send_message_with_keyboard and stores permission", async () => {
		const { deps, telegram, state } = makeDeps();
		telegram.nextMessageId = 99;

		await executeEffects(
			[
				{
					type: "send_message_with_keyboard",
					text: "Permission prompt",
					keyboard: { inline_keyboard: [] },
					storeAs: "permission" as const,
					permissionRequestID: "perm1",
				},
			],
			deps,
		);

		expect(state.pendingPermissions.has(99)).toBe(true);
		expect(state.pendingPermissions.get(99)?.requestID).toBe("perm1");
	});

	it("executes send_message_with_keyboard and stores question activeMessageId", async () => {
		const { deps, telegram, state } = makeDeps();
		state.questionState = {
			requestID: "q1",
			questions: [],
			currentIndex: 0,
			answers: [],
			selectedOptions: new Map(),
			customAnswers: new Map(),
			activeMessageId: null,
		};
		telegram.nextMessageId = 55;

		await executeEffects(
			[
				{
					type: "send_message_with_keyboard",
					text: "Question",
					keyboard: { inline_keyboard: [] },
					storeAs: "question" as const,
				},
			],
			deps,
		);

		expect(state.questionState?.activeMessageId).toBe(55);
	});

	it("executes effects sequentially", async () => {
		const { deps, telegram } = makeDeps();

		const effects: Effect[] = [
			{ type: "send_formatted_message", text: "first" },
			{ type: "send_formatted_message", text: "second" },
		];

		await executeEffects(effects, deps);

		const sends = telegram.calls.filter((c) => c.method === "sendMessage");
		expect(sends.length).toBeGreaterThanOrEqual(2);
	});

	it("continues after an error in one effect", async () => {
		const { deps, telegram } = makeDeps();
		telegram.failNextSend = true;

		const effects: Effect[] = [
			{ type: "send_formatted_message", text: "will fail" },
			{ type: "send_notice", kind: "error", message: "should still send" },
		];

		await executeEffects(effects, deps);

		// The second effect should have still been attempted
		const sends = telegram.calls.filter((c) => c.method === "sendMessage");
		expect(sends.length).toBeGreaterThanOrEqual(1);
	});
});

describe("executeCallbackEffects", () => {
	it("executes answer_callback", async () => {
		const { deps, telegram } = makeDeps();
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		await executeCallbackEffects(
			[{ type: "answer_callback", text: "Done" }],
			cbDeps,
		);

		expect(telegram.calls[0]?.method).toBe("answerCallbackQuery");
		expect(telegram.calls[0]?.args[0]).toBe("cb1");
	});

	it("executes edit_message", async () => {
		const { deps, telegram } = makeDeps();
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		await executeCallbackEffects(
			[{ type: "edit_message", text: "Updated text" }],
			cbDeps,
		);

		expect(telegram.calls[0]?.method).toBe("editMessageText");
	});

	it("executes reply_permission", async () => {
		const { deps, opencode } = makeDeps();
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		await executeCallbackEffects(
			[{ type: "reply_permission", requestID: "perm1", reply: "once" }],
			cbDeps,
		);

		expect(opencode.calls[0]?.method).toBe("replyPermission");
	});

	it("executes clear_question_state", async () => {
		const { deps, state } = makeDeps();
		state.questionState = {
			requestID: "q1",
			questions: [],
			currentIndex: 0,
			answers: [],
			selectedOptions: new Map(),
			customAnswers: new Map(),
			activeMessageId: null,
		};
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		await executeCallbackEffects([{ type: "clear_question_state" }], cbDeps);

		expect(state.questionState).toBeNull();
	});

	it("executes remove_pending_permission", async () => {
		const { deps, state } = makeDeps();
		state.pendingPermissions.set(10, { requestID: "r", messageId: 10 });
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		await executeCallbackEffects(
			[{ type: "remove_pending_permission", messageId: 10 }],
			cbDeps,
		);

		expect(state.pendingPermissions.has(10)).toBe(false);
	});

	it("executes delete_message — deletes via telegram", async () => {
		const { deps, telegram } = makeDeps();
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 42,
		};

		await executeCallbackEffects([{ type: "delete_message" }], cbDeps);

		const call = telegram.calls.find((c) => c.method === "deleteMessage");
		expect(call).toBeDefined();
		expect(call?.args[0]).toBe(123); // chatId
		expect(call?.args[1]).toBe(42); // callbackMessageId
	});

	it("executes reply_question — sends answers to opencode", async () => {
		const { deps, opencode } = makeDeps();
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		await executeCallbackEffects(
			[
				{
					type: "reply_question",
					requestID: "q1",
					answers: [["option-a"], ["option-b"]],
				},
			],
			cbDeps,
		);

		const call = opencode.calls.find((c) => c.method === "replyQuestion");
		expect(call).toBeDefined();
		expect(call?.args[0]).toBe("q1");
		expect(call?.args[1]).toBe("/test");
		expect(call?.args[2]).toEqual([["option-a"], ["option-b"]]);
	});

	it("executes start_typing in callback context", async () => {
		const { deps, timer, state } = makeDeps();
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		await executeCallbackEffects([{ type: "start_typing" }], cbDeps);

		expect(state.typingHandle).not.toBeNull();
		expect(timer.registrations.length).toBe(1);
		expect(timer.registrations[0]?.ms).toBe(4000);
	});

	it("start_typing in callback context is no-op when already typing", async () => {
		const { deps, timer, state } = makeDeps();
		state.typingHandle = "existing";
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		await executeCallbackEffects([{ type: "start_typing" }], cbDeps);

		expect(timer.registrations.length).toBe(0);
		expect(state.typingHandle).toBe("existing");
	});

	it("executes stop_typing in callback context", async () => {
		const { deps, timer, state } = makeDeps();
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		// Start first
		await executeCallbackEffects([{ type: "start_typing" }], cbDeps);
		expect(state.typingHandle).not.toBeNull();

		// Stop
		await executeCallbackEffects([{ type: "stop_typing" }], cbDeps);
		expect(state.typingHandle).toBeNull();
		expect(timer.registrations[0]?.cleared).toBe(true);
	});

	it("stop_typing in callback context is no-op when not typing", async () => {
		const { deps, state } = makeDeps();
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		await executeCallbackEffects([{ type: "stop_typing" }], cbDeps);
		expect(state.typingHandle).toBeNull();
	});

	it("executes advance_question — delegates to computeAdvanceEffects", async () => {
		const { deps } = makeDeps();
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		const qs: QuestionState = {
			requestID: "q1",
			questions: [
				{
					header: "Q1",
					question: "Pick one",
					options: [
						{ label: "A", description: "Option A" },
						{ label: "B", description: "Option B" },
					],
				},
				{
					header: "Q2",
					question: "Pick another",
					options: [{ label: "C", description: "Option C" }],
				},
			],
			currentIndex: 0,
			answers: [],
			selectedOptions: new Map([[0, new Set([0])]]),
			customAnswers: new Map(),
			activeMessageId: 10,
		};

		await executeCallbackEffects(
			[{ type: "advance_question", questionState: qs, questionIndex: 0 }],
			cbDeps,
		);

		// advance_question should produce sub-effects that get executed
		// At minimum it records the answer for the current question
		expect(qs.answers[0]).toBeDefined();
	});

	it("executes show_question — sends question message with keyboard", async () => {
		const { deps, telegram } = makeDeps();
		telegram.nextMessageId = 77;
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		const qs: QuestionState = {
			requestID: "q1",
			questions: [
				{
					header: "Setup",
					question: "Choose your option",
					options: [
						{ label: "Yes", description: "Confirm" },
						{ label: "No", description: "Deny" },
					],
				},
			],
			currentIndex: 0,
			answers: [],
			selectedOptions: new Map(),
			customAnswers: new Map(),
			activeMessageId: null,
		};

		await executeCallbackEffects(
			[{ type: "show_question", questionState: qs }],
			cbDeps,
		);

		const sendCall = telegram.calls.find((c) => c.method === "sendMessage");
		expect(sendCall).toBeDefined();
		// Should include reply_markup (keyboard)
		const opts = sendCall?.args[2] as { reply_markup?: unknown };
		expect(opts.reply_markup).toBeDefined();
		// activeMessageId should be set to the sent message id
		expect(qs.activeMessageId).toBe(77);
	});

	it("show_question is no-op when currentIndex has no question", async () => {
		const { deps, telegram } = makeDeps();
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		const qs: QuestionState = {
			requestID: "q1",
			questions: [],
			currentIndex: 0,
			answers: [],
			selectedOptions: new Map(),
			customAnswers: new Map(),
			activeMessageId: null,
		};

		await executeCallbackEffects(
			[{ type: "show_question", questionState: qs }],
			cbDeps,
		);

		// No message should be sent since there is no question at index 0
		const sendCall = telegram.calls.find((c) => c.method === "sendMessage");
		expect(sendCall).toBeUndefined();
		expect(qs.activeMessageId).toBeNull();
	});

	it("continues after an error in one callback effect", async () => {
		const { deps, telegram, state } = makeDeps();
		telegram.failNextSend = true;
		state.questionState = {
			requestID: "q1",
			questions: [
				{
					header: "Q",
					question: "Pick",
					options: [{ label: "A", description: "a" }],
				},
			],
			currentIndex: 0,
			answers: [],
			selectedOptions: new Map(),
			customAnswers: new Map(),
			activeMessageId: null,
		};
		const cbDeps = {
			...deps,
			callbackQueryId: "cb1",
			callbackMessageId: 10,
		};

		const effects: CallbackEffect[] = [
			// show_question will call sendMessage which will fail
			{ type: "show_question", questionState: state.questionState },
			// clear_question_state should still execute
			{ type: "clear_question_state" },
		];

		await executeCallbackEffects(effects, cbDeps);

		// The second effect should have still been attempted despite the first failing
		expect(state.questionState).toBeNull();
	});
});

describe("executeEffects — additional coverage", () => {
	it("executes send_notice with a codeBlock parameter", async () => {
		const { deps, telegram } = makeDeps();

		await executeEffects(
			[
				{
					type: "send_notice",
					kind: "error",
					message: "Something went wrong",
					codeBlock: { language: "json", content: '{"error": true}' },
				},
			],
			deps,
		);

		const call = telegram.calls.find((c) => c.method === "sendMessage");
		expect(call).toBeDefined();
		// The message text should contain the code block content
		const text = call?.args[1] as string;
		expect(text).toContain("error");
		// Should include disable_notification
		const opts = call?.args[2] as { disable_notification?: boolean };
		expect(opts.disable_notification).toBe(true);
	});

	it("executes delete_message effect", async () => {
		const { deps, telegram } = makeDeps();

		await executeEffects([{ type: "delete_message", messageId: 42 }], deps);

		const call = telegram.calls.find((c) => c.method === "deleteMessage");
		expect(call).toBeDefined();
		expect(call?.args[0]).toBe(123); // chatId
		expect(call?.args[1]).toBe(42); // messageId
	});
});
