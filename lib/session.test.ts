import { describe, expect, test } from "bun:test";
import { loadSessionID, saveSessionID } from "~/lib/session";

describe("session persistence", () => {
	test("saveSessionID persists and loadSessionID retrieves it", () => {
		const id = `test-session-${Date.now()}`;
		saveSessionID(id);
		expect(loadSessionID()).toBe(id);
	});

	test("saveSessionID(null) clears the session ID", () => {
		saveSessionID("temp-session");
		expect(loadSessionID()).toBe("temp-session");

		saveSessionID(null);
		expect(loadSessionID()).toBeNull();
	});

	test("saveSessionID overwrites previous value", () => {
		saveSessionID("first");
		saveSessionID("second");
		expect(loadSessionID()).toBe("second");
	});

	test("loadSessionID returns null when no session exists", () => {
		// Clear any existing session
		saveSessionID(null);
		expect(loadSessionID()).toBeNull();
	});
});
