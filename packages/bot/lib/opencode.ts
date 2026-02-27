import type { Event } from "@opencode-ai/sdk/v2";
import { createOpencodeClient } from "@opencode-ai/sdk/v2";

export type EventCallback = (event: Event) => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

let client: ReturnType<typeof createOpencodeClient>;
let isListening = false;
let activeDirectory: string | null = null;
let streamAbortController: AbortController | null = null;
let eventCallback: EventCallback | null = null;

export function initClient(baseUrl: string): void {
	client = createOpencodeClient({ baseUrl });
}

export function getClient(): ReturnType<typeof createOpencodeClient> {
	if (!client)
		throw new Error(
			"OpenCode client not initialized — call initClient() first",
		);
	return client;
}

function getReconnectDelay(attempt: number): number {
	return Math.min(
		RECONNECT_BASE_MS * 2 ** Math.max(0, attempt - 1),
		RECONNECT_MAX_MS,
	);
}

function waitWithAbort(ms: number, signal: AbortSignal): Promise<boolean> {
	return new Promise((resolve) => {
		if (signal.aborted) {
			resolve(false);
			return;
		}
		const onAbort = () => {
			clearTimeout(timer);
			signal.removeEventListener("abort", onAbort);
			resolve(false);
		};
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve(true);
		}, ms);
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

export async function subscribeToEvents(
	directory: string,
	callback: EventCallback,
): Promise<void> {
	if (isListening && activeDirectory === directory) {
		eventCallback = callback;
		return;
	}

	if (isListening && activeDirectory !== directory) {
		streamAbortController?.abort();
		streamAbortController = null;
		isListening = false;
		activeDirectory = null;
	}

	const controller = new AbortController();
	activeDirectory = directory;
	eventCallback = callback;
	isListening = true;
	streamAbortController = controller;

	let attempt = 0;

	try {
		while (
			isListening &&
			activeDirectory === directory &&
			!controller.signal.aborted
		) {
			try {
				const result = await client.event.subscribe(
					{ directory },
					{ signal: controller.signal },
				);

				if (!result.stream)
					throw new Error("No stream returned from event subscription");

				attempt = 0;

				for await (const event of result.stream) {
					if (
						!isListening ||
						activeDirectory !== directory ||
						controller.signal.aborted
					)
						break;

					// Yield to event loop so grammY's getUpdates polling isn't starved
					await new Promise<void>((resolve) => setImmediate(resolve));

					if (eventCallback) {
						const cb = eventCallback;
						setImmediate(() => cb(event));
					}
				}

				if (
					!isListening ||
					activeDirectory !== directory ||
					controller.signal.aborted
				)
					break;

				attempt++;
				const delay = getReconnectDelay(attempt);
				console.log(
					`[opencode] Stream ended, reconnecting in ${delay}ms (attempt=${attempt})`,
				);
				if (!(await waitWithAbort(delay, controller.signal))) break;
			} catch (error) {
				if (
					controller.signal.aborted ||
					!isListening ||
					activeDirectory !== directory
				)
					return;

				attempt++;
				const delay = getReconnectDelay(attempt);
				console.error(
					`[opencode] Stream error, reconnecting in ${delay}ms:`,
					error,
				);
				if (!(await waitWithAbort(delay, controller.signal))) break;
			}
		}
	} finally {
		if (streamAbortController === controller) {
			streamAbortController = null;
			isListening = false;
			activeDirectory = null;
			eventCallback = null;
		}
	}
}

export function stopEventListening(): void {
	streamAbortController?.abort();
	streamAbortController = null;
	isListening = false;
	activeDirectory = null;
	eventCallback = null;
}
