import { describe, expect, it } from "bun:test";
import type { Event } from "@opencode-ai/sdk/v2";
import { processEvent } from "~/lib/core/event-processor";
import { createSessionState } from "~/lib/core/session-state";
import type { SessionState } from "~/lib/core/types";

const SESSION_ID = "test-session";

function makeState(): SessionState {
	return createSessionState();
}

describe("processEvent", () => {
	describe("message.part.updated (text)", () => {
		it("accumulates text and returns start_typing", () => {
			const state = makeState();
			const event = {
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: SESSION_ID,
						messageID: "msg1",
						type: "text",
						text: "Hello world",
					},
				},
			} as unknown as Event;

			const effects = processEvent(event, SESSION_ID, state);

			expect(state.accumulatedText.get("msg1")).toBe("Hello world");
			expect(effects).toEqual([{ type: "start_typing" }]);
		});

		it("overwrites text on subsequent updates", () => {
			const state = makeState();
			state.accumulatedText.set("msg1", "old");

			const event = {
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: SESSION_ID,
						messageID: "msg1",
						type: "text",
						text: "new text",
					},
				},
			} as unknown as Event;

			processEvent(event, SESSION_ID, state);
			expect(state.accumulatedText.get("msg1")).toBe("new text");
		});

		it("ignores events for different sessions", () => {
			const state = makeState();
			const event = {
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: "other-session",
						messageID: "msg1",
						type: "text",
						text: "hello",
					},
				},
			} as unknown as Event;

			const effects = processEvent(event, SESSION_ID, state);
			expect(effects).toEqual([]);
			expect(state.accumulatedText.size).toBe(0);
		});
	});

	describe("message.part.updated (file/tool)", () => {
		it("ignores file parts", () => {
			const state = makeState();
			const event = {
				type: "message.part.updated",
				properties: {
					part: {
						sessionID: SESSION_ID,
						messageID: "msg1",
						type: "file",
					},
				},
			} as unknown as Event;

			const effects = processEvent(event, SESSION_ID, state);
			expect(effects).toEqual([]);
		});
	});

	describe("message.updated", () => {
		it("sends formatted message and stops typing when last message", () => {
			const state = makeState();
			state.accumulatedText.set("msg1", "Final text");

			const event = {
				type: "message.updated",
				properties: {
					info: {
						sessionID: SESSION_ID,
						role: "assistant",
						id: "msg1",
						time: { completed: Date.now() },
					},
				},
			} as unknown as Event;

			const effects = processEvent(event, SESSION_ID, state);
			expect(effects).toEqual([
				{ type: "send_formatted_message", text: "Final text" },
				{ type: "stop_typing" },
			]);
			expect(state.accumulatedText.has("msg1")).toBe(false);
		});

		it("does not stop typing when other messages still pending", () => {
			const state = makeState();
			state.accumulatedText.set("msg1", "text1");
			state.accumulatedText.set("msg2", "text2");

			const event = {
				type: "message.updated",
				properties: {
					info: {
						sessionID: SESSION_ID,
						role: "assistant",
						id: "msg1",
						time: { completed: Date.now() },
					},
				},
			} as unknown as Event;

			const effects = processEvent(event, SESSION_ID, state);
			expect(effects).toEqual([
				{ type: "send_formatted_message", text: "text1" },
			]);
		});

		it("ignores non-assistant roles", () => {
			const state = makeState();
			const event = {
				type: "message.updated",
				properties: {
					info: {
						sessionID: SESSION_ID,
						role: "user",
						id: "msg1",
						time: { completed: Date.now() },
					},
				},
			} as unknown as Event;

			const effects = processEvent(event, SESSION_ID, state);
			expect(effects).toEqual([]);
		});

		it("ignores messages without completed time", () => {
			const state = makeState();
			const event = {
				type: "message.updated",
				properties: {
					info: {
						sessionID: SESSION_ID,
						role: "assistant",
						id: "msg1",
						time: {},
					},
				},
			} as unknown as Event;

			const effects = processEvent(event, SESSION_ID, state);
			expect(effects).toEqual([]);
		});
	});

	describe("session.error", () => {
		it("stops typing, resets state, sends error notice", () => {
			const state = makeState();
			const event = {
				type: "session.error",
				properties: {
					sessionID: SESSION_ID,
					error: { message: "Something broke" },
				},
			} as unknown as Event;

			const effects = processEvent(event, SESSION_ID, state);
			expect(effects).toEqual([
				{ type: "stop_typing" },
				{ type: "reset_state" },
				{ type: "send_notice", kind: "error", message: "Something broke" },
			]);
		});

		it("extracts error from data.message", () => {
			const state = makeState();
			const event = {
				type: "session.error",
				properties: {
					sessionID: SESSION_ID,
					error: { data: { message: "Nested error" } },
				},
			} as unknown as Event;

			const effects = processEvent(event, SESSION_ID, state);
			expect(effects[2]).toEqual({
				type: "send_notice",
				kind: "error",
				message: "Nested error",
			});
		});
	});

	describe("session.idle", () => {
		it("stops typing and resets state", () => {
			const state = makeState();
			const event = {
				type: "session.idle",
				properties: { sessionID: SESSION_ID },
			} as unknown as Event;

			const effects = processEvent(event, SESSION_ID, state);
			expect(effects).toEqual([
				{ type: "stop_typing" },
				{ type: "reset_state" },
			]);
		});
	});

	describe("permission.asked", () => {
		it("returns permission prompt with keyboard", () => {
			const state = makeState();
			const event = {
				type: "permission.asked",
				properties: {
					id: "perm1",
					sessionID: SESSION_ID,
					permission: "file_read",
					patterns: ["/etc/*"],
				},
			} as unknown as Event;

			const effects = processEvent(event, SESSION_ID, state);
			expect(effects.length).toBe(1);
			expect(effects[0]?.type).toBe("send_message_with_keyboard");
			const effect = effects[0] as {
				storeAs: string;
				permissionRequestID: string;
			};
			expect(effect.storeAs).toBe("permission");
			expect(effect.permissionRequestID).toBe("perm1");
		});
	});

	describe("question.asked", () => {
		it("stores question state and returns stop_typing + show question", () => {
			const state = makeState();
			const event = {
				type: "question.asked",
				properties: {
					id: "q1",
					sessionID: SESSION_ID,
					questions: [
						{
							header: "Test",
							question: "Choose",
							options: [{ label: "A", description: "opt A" }],
						},
					],
				},
			} as unknown as Event;

			const effects = processEvent(event, SESSION_ID, state);
			expect(state.questionState).not.toBeNull();
			expect(state.questionState?.requestID).toBe("q1");
			expect(effects.length).toBe(2);
			expect(effects[0]?.type).toBe("stop_typing");
			expect(effects[1]?.type).toBe("send_message_with_keyboard");
		});
	});
});
