import type { TimerHandle, TimerPort } from "~/lib/ports/timer";

export interface TimerRegistration {
	id: number;
	callback: () => void;
	ms: number;
	cleared: boolean;
}

export function createTimerStub(): TimerPort & {
	registrations: TimerRegistration[];
	tick(id?: number): void;
	tickAll(): void;
} {
	const registrations: TimerRegistration[] = [];
	let nextId = 1;

	return {
		registrations,

		setInterval(callback: () => void, ms: number): TimerHandle {
			const id = nextId++;
			registrations.push({ id, callback, ms, cleared: false });
			return id;
		},

		clearInterval(handle: TimerHandle): void {
			const reg = registrations.find((r) => r.id === handle);
			if (reg) reg.cleared = true;
		},

		/** Fire the callback for a specific registration (by id) */
		tick(id?: number): void {
			const active = registrations.filter((r) => !r.cleared);
			if (id !== undefined) {
				const reg = active.find((r) => r.id === id);
				if (reg) reg.callback();
			} else if (active.length > 0) {
				active[active.length - 1]?.callback();
			}
		},

		/** Fire all active callbacks */
		tickAll(): void {
			for (const reg of registrations) {
				if (!reg.cleared) reg.callback();
			}
		},
	};
}
