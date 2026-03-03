import { describe, expect, test } from "bun:test";
import { getReconnectDelay } from "~/lib/opencode";

describe("getReconnectDelay", () => {
	test("returns base delay (1000ms) for attempt 0", () => {
		expect(getReconnectDelay(0)).toBe(1000);
	});

	test("returns base delay (1000ms) for attempt 1", () => {
		expect(getReconnectDelay(1)).toBe(1000);
	});

	test("doubles for attempt 2 (2000ms)", () => {
		expect(getReconnectDelay(2)).toBe(2000);
	});

	test("quadruples for attempt 3 (4000ms)", () => {
		expect(getReconnectDelay(3)).toBe(4000);
	});

	test("8000ms for attempt 4", () => {
		expect(getReconnectDelay(4)).toBe(8000);
	});

	test("caps at 15000ms for attempt 5", () => {
		expect(getReconnectDelay(5)).toBe(15000);
	});

	test("stays capped at 15000ms for high attempts", () => {
		expect(getReconnectDelay(10)).toBe(15000);
		expect(getReconnectDelay(100)).toBe(15000);
	});

	test("follows exponential backoff pattern", () => {
		const delays = [0, 1, 2, 3, 4, 5].map(getReconnectDelay);
		// Each delay should be >= previous (monotonically non-decreasing)
		for (let i = 1; i < delays.length; i++) {
			expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]!);
		}
	});

	test("never exceeds 15000ms", () => {
		for (let i = 0; i <= 20; i++) {
			expect(getReconnectDelay(i)).toBeLessThanOrEqual(15000);
		}
	});
});
