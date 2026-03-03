import { describe, expect, test } from "bun:test";
import {
	SESSION_LOCKED_MAX_RETRIES,
	SESSION_LOCKED_RETRY_DELAY_MS,
} from "~/lib/prompt";

describe("prompt constants", () => {
	test("SESSION_LOCKED_RETRY_DELAY_MS is 1000ms", () => {
		expect(SESSION_LOCKED_RETRY_DELAY_MS).toBe(1000);
	});

	test("SESSION_LOCKED_MAX_RETRIES is 3", () => {
		expect(SESSION_LOCKED_MAX_RETRIES).toBe(3);
	});
});
