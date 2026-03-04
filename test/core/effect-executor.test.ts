import { describe, expect, it } from "bun:test";
import {
	executeCallbackEffects,
	executeEffects,
} from "~/lib/core/effect-executor";
import { createSessionState } from "~/lib/core/session-state";
import type { Effect, SessionState } from "~/lib/core/types";
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
});
