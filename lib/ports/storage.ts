/** Persistent storage boundary — session ID persistence. */

export interface StoragePort {
	getSessionID(): string | null;
	setSessionID(id: string): void;
}
