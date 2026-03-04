/**
 * Tests for OpenCodeSdkAdapter — focuses on SSE subscription lifecycle
 * and reconnect behavior that can be observed through the class's public API.
 *
 * Since getReconnectDelay and waitWithAbort are module-private, we verify
 * their effects indirectly through subscribeToEvents / stopEventListening.
 */

import { describe, expect, it, mock } from "bun:test";
import { OpenCodeSdkAdapter } from "~/lib/adapters/opencode-sdk";

// ---------------------------------------------------------------------------
// Helpers — mock SDK client injected via constructor's createOpencodeClient
// ---------------------------------------------------------------------------

/**
 * Build an OpenCodeSdkAdapter whose internal `this.client` is a mock.
 * We achieve this by monkey-patching the private `client` field right after
 * construction (Bun/TS lets us access private fields at runtime).
 */
function createTestAdapter() {
	// Construct with a dummy baseUrl — the real HTTP client won't be used.
	const adapter = new OpenCodeSdkAdapter("http://localhost:0");

	const subscribeCalls: Array<{
		directory: string;
		signal: AbortSignal;
	}> = [];

	// Controls what the next event.subscribe() call returns.
	let nextStream: AsyncIterable<unknown> | null = null;
	let nextSubscribeError: Error | null = null;
	let subscribeResolve: (() => void) | null = null;
	let subscribeBlock: Promise<void> | null = null;

	const mockClient = {
		event: {
			subscribe: mock(
				async (
					params: { directory: string },
					opts: { signal: AbortSignal },
				) => {
					subscribeCalls.push({
						directory: params.directory,
						signal: opts.signal,
					});

					if (nextSubscribeError) {
						const err = nextSubscribeError;
						nextSubscribeError = null;
						throw err;
					}

					// If a blocking promise was set, wait on it (simulates a long-lived stream setup).
					if (subscribeBlock) {
						await subscribeBlock;
						subscribeBlock = null;
					}

					const stream = nextStream;
					nextStream = null;
					return { stream };
				},
			),
		},
		project: { current: mock(async () => ({ data: { worktree: "/mock" } })) },
		session: {
			create: mock(async () => ({ data: { id: "mock-session" }, error: null })),
			prompt: mock(async () => ({ error: null })),
			abort: mock(async () => {}),
		},
		permission: { reply: mock(async () => {}) },
		question: { reply: mock(async () => {}) },
		mcp: {
			add: mock(async () => {}),
			connect: mock(async () => {}),
		},
	};

	// Monkey-patch the private client field.
	(adapter as unknown as { client: typeof mockClient }).client = mockClient;

	return {
		adapter,
		mockClient,
		subscribeCalls,

		/** Set the async iterable that the next subscribe() call will return. */
		setNextStream(stream: AsyncIterable<unknown>) {
			nextStream = stream;
		},

		/** Make the next subscribe() call throw. */
		setNextSubscribeError(err: Error) {
			nextSubscribeError = err;
		},

		/**
		 * Make the next subscribe() call block until `releaseSubscribe()` is called.
		 * Useful for testing abort mid-connection.
		 */
		blockNextSubscribe() {
			subscribeBlock = new Promise<void>((resolve) => {
				subscribeResolve = resolve;
			});
		},

		releaseSubscribe() {
			subscribeResolve?.();
		},
	};
}

/** Build an async iterable that yields the given values then returns. */
async function* iterableOf<T>(...values: T[]): AsyncIterable<T> {
	for (const v of values) {
		yield v;
	}
}

/** Build an async iterable that never yields (hangs until broken externally). */
function hangingIterable(): AsyncIterable<unknown> & { stop(): void } {
	let stopped = false;
	let resolve: (() => void) | null = null;

	const iter: AsyncIterable<unknown> & { stop(): void } = {
		stop() {
			stopped = true;
			resolve?.();
		},
		[Symbol.asyncIterator]() {
			return {
				next() {
					if (stopped) return Promise.resolve({ done: true, value: undefined });
					return new Promise<IteratorResult<unknown>>((r) => {
						resolve = () => r({ done: true, value: undefined });
					});
				},
			};
		},
	};
	return iter;
}

/** Flush microtasks + setImmediate callbacks so the adapter's internal loop progresses. */
async function flush(times = 5) {
	for (let i = 0; i < times; i++) {
		await new Promise<void>((r) => setImmediate(r));
		// Small real delay to allow setTimeout-based reconnect logic to settle.
		await Bun.sleep(5);
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OpenCodeSdkAdapter", () => {
	describe("stopEventListening", () => {
		it("stops an active subscription", async () => {
			const t = createTestAdapter();
			const stream = hangingIterable();
			t.setNextStream(stream);

			const subPromise = t.adapter.subscribeToEvents("/proj", () => {});
			await flush();

			expect(t.subscribeCalls.length).toBeGreaterThanOrEqual(1);

			// Stop — should cause subscribeToEvents to resolve.
			stream.stop();
			t.adapter.stopEventListening();
			await flush();

			// The promise should eventually settle (not hang forever).
			// We race against a timeout to assert this.
			const result = await Promise.race([
				subPromise.then(() => "resolved" as const),
				Bun.sleep(2000).then(() => "timeout" as const),
			]);
			expect(result).toBe("resolved");
		});

		it("is safe to call when not listening", () => {
			const { adapter } = createTestAdapter();
			// Should not throw.
			adapter.stopEventListening();
		});

		it("is idempotent — calling twice does not throw", async () => {
			const t = createTestAdapter();
			t.setNextStream(hangingIterable());
			const sub = t.adapter.subscribeToEvents("/proj", () => {});
			await flush();

			t.adapter.stopEventListening();
			t.adapter.stopEventListening();
			await flush();

			// Should settle without error.
			await Promise.race([sub, Bun.sleep(1000)]);
		});
	});

	describe("subscribeToEvents — idempotency", () => {
		it("updates callback without re-subscribing when directory is the same", async () => {
			const t = createTestAdapter();
			const stream = hangingIterable();
			t.setNextStream(stream);

			const cb1 = mock(() => {});
			const _sub1 = t.adapter.subscribeToEvents("/proj", cb1);
			await flush();

			// First call should have triggered one subscribe.
			const callCountAfterFirst = t.subscribeCalls.length;
			expect(callCountAfterFirst).toBeGreaterThanOrEqual(1);

			// Second call with same directory — should NOT trigger another subscribe.
			const cb2 = mock(() => {});
			const _sub2 = t.adapter.subscribeToEvents("/proj", cb2);
			await flush();

			// subscribe call count should not have increased.
			expect(t.subscribeCalls.length).toBe(callCountAfterFirst);

			// Clean up.
			stream.stop();
			t.adapter.stopEventListening();
			await flush();
		});
	});

	describe("subscribeToEvents — directory switch", () => {
		it("aborts previous subscription when directory changes", async () => {
			const t = createTestAdapter();
			const stream1 = hangingIterable();
			t.setNextStream(stream1);

			const _sub1 = t.adapter.subscribeToEvents("/proj-a", () => {});
			await flush();

			// Record the abort signal from the first subscribe.
			const firstSignal = t.subscribeCalls[0]?.signal;
			expect(firstSignal).toBeDefined();

			// Now subscribe with a different directory — should abort the first.
			const stream2 = hangingIterable();
			t.setNextStream(stream2);
			const _sub2 = t.adapter.subscribeToEvents("/proj-b", () => {});
			await flush();

			// The first signal should have been aborted.
			expect(firstSignal?.aborted).toBe(true);

			// A new subscribe call should have been made for proj-b.
			const projBCalls = t.subscribeCalls.filter(
				(c) => c.directory === "/proj-b",
			);
			expect(projBCalls.length).toBeGreaterThanOrEqual(1);

			// Clean up.
			stream1.stop();
			stream2.stop();
			t.adapter.stopEventListening();
			await flush();
		});
	});

	describe("event delivery", () => {
		it("delivers events from the stream to the callback", async () => {
			const t = createTestAdapter();
			const events = [
				{ type: "event.session.updated", properties: { id: "s1" } },
				{ type: "event.message.updated", properties: { id: "m1" } },
			];
			t.setNextStream(iterableOf(...events));

			const received: unknown[] = [];
			const _sub = t.adapter.subscribeToEvents("/proj", (evt) => {
				received.push(evt);
			});

			// Allow the stream to be consumed and setImmediate callbacks to fire.
			await flush(20);

			expect(received.length).toBe(2);
			expect(received[0]).toEqual(events[0]);
			expect(received[1]).toEqual(events[1]);

			// After the finite stream ends, the adapter will attempt to reconnect.
			// Stop to clean up.
			t.adapter.stopEventListening();
			await flush();
		});
	});

	describe("reconnect on stream end", () => {
		it("re-subscribes after a finite stream ends", async () => {
			const t = createTestAdapter();

			// First stream: yields one event then ends.
			t.setNextStream(iterableOf({ type: "event.ping" }));

			const _sub = t.adapter.subscribeToEvents("/proj", () => {});
			// Wait enough for the stream to end and the reconnect delay to start.
			// The first reconnect delay is 1000ms (attempt=1), so we need to wait a bit.
			await Bun.sleep(50);
			await flush(10);

			// Should have at least 1 subscribe call from the initial connection.
			expect(t.subscribeCalls.length).toBeGreaterThanOrEqual(1);

			// After the reconnect delay (~1000ms for attempt 1), it should try again.
			// Provide another stream for the reconnect.
			const stream2 = hangingIterable();
			t.setNextStream(stream2);

			// Wait past the reconnect delay.
			await Bun.sleep(1200);
			await flush(10);

			// Should have made a second subscribe call.
			expect(t.subscribeCalls.length).toBeGreaterThanOrEqual(2);

			// Clean up.
			stream2.stop();
			t.adapter.stopEventListening();
			await flush();
		});
	});

	describe("reconnect on error", () => {
		it("re-subscribes after a subscribe error", async () => {
			const t = createTestAdapter();

			// First call throws an error.
			t.setNextSubscribeError(new Error("connection refused"));

			const _sub = t.adapter.subscribeToEvents("/proj", () => {});
			await flush(10);

			// Should have made the first (failed) call.
			expect(t.subscribeCalls.length).toBeGreaterThanOrEqual(1);

			// Provide a hanging stream for the retry.
			const stream = hangingIterable();
			t.setNextStream(stream);

			// Wait past the reconnect delay (~1000ms for attempt 1).
			await Bun.sleep(1200);
			await flush(10);

			// Should have retried.
			expect(t.subscribeCalls.length).toBeGreaterThanOrEqual(2);

			// Clean up.
			stream.stop();
			t.adapter.stopEventListening();
			await flush();
		});
	});

	describe("reconnect on missing stream", () => {
		it("reconnects when subscribe returns no stream", async () => {
			const t = createTestAdapter();

			// Don't set a stream — subscribe will return { stream: null }.
			const _sub = t.adapter.subscribeToEvents("/proj", () => {});
			await flush(10);

			expect(t.subscribeCalls.length).toBeGreaterThanOrEqual(1);

			// Provide a real stream for retry.
			const stream = hangingIterable();
			t.setNextStream(stream);

			await Bun.sleep(1200);
			await flush(10);

			expect(t.subscribeCalls.length).toBeGreaterThanOrEqual(2);

			stream.stop();
			t.adapter.stopEventListening();
			await flush();
		});
	});
});
