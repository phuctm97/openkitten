/** Timer boundary — interval management for typing indicators. */

export type TimerHandle = unknown;

export interface TimerPort {
	setInterval(callback: () => void, ms: number): TimerHandle;
	clearInterval(handle: TimerHandle): void;
}
