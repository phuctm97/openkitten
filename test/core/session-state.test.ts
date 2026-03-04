import { describe, expect, it } from "bun:test";
import {
	createSessionState,
	resetSessionState,
} from "~/lib/core/session-state";

describe("createSessionState", () => {
	it("creates a fresh state with empty maps", () => {
		const state = createSessionState();
		expect(state.accumulatedText.size).toBe(0);
		expect(state.pendingPermissions.size).toBe(0);
		expect(state.questionState).toBeNull();
		expect(state.typingHandle).toBeNull();
	});
});

describe("resetSessionState", () => {
	it("clears all in-flight state", () => {
		const state = createSessionState();
		state.accumulatedText.set("msg1", "hello");
		state.pendingPermissions.set(1, { requestID: "r1", messageId: 1 });
		state.questionState = {
			requestID: "q1",
			questions: [],
			currentIndex: 0,
			answers: [],
			selectedOptions: new Map(),
			customAnswers: new Map(),
			activeMessageId: 42,
		};

		resetSessionState(state);

		expect(state.accumulatedText.size).toBe(0);
		expect(state.pendingPermissions.size).toBe(0);
		expect(state.questionState).toBeNull();
	});

	it("does NOT clear typingHandle", () => {
		const state = createSessionState();
		state.typingHandle = "some-handle";

		resetSessionState(state);

		expect(state.typingHandle).toBe("some-handle");
	});
});
