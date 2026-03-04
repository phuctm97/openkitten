import type { SessionState } from "./types";

export function createSessionState(): SessionState {
	return {
		accumulatedText: new Map(),
		pendingPermissions: new Map(),
		questionState: null,
		typingHandle: null,
	};
}

export function resetSessionState(state: SessionState): void {
	state.accumulatedText.clear();
	state.pendingPermissions.clear();
	state.questionState = null;
	// Note: typingHandle is NOT cleared here — the executor manages start/stop typing
}
