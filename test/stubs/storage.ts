import type { StoragePort } from "~/lib/ports/storage";

export function createStorageStub(): StoragePort & {
	currentSessionID: string | null;
} {
	let sessionID: string | null = null;

	return {
		get currentSessionID() {
			return sessionID;
		},
		set currentSessionID(v: string | null) {
			sessionID = v;
		},

		getSessionID(): string | null {
			return sessionID;
		},

		setSessionID(id: string): void {
			sessionID = id;
		},
	};
}
