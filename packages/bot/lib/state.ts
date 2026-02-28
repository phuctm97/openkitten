export interface SessionInfo {
	id: string;
	title: string;
	directory: string;
}

export interface PendingPermission {
	requestID: string;
	messageId: number;
}

export interface QuestionOption {
	label: string;
	description: string;
}

export interface QuestionItem {
	header: string;
	question: string;
	options: QuestionOption[];
	multiple?: boolean;
}

export interface QuestionState {
	requestID: string;
	questions: QuestionItem[];
	currentIndex: number;
	answers: string[][];
	selectedOptions: Map<number, Set<number>>;
	customAnswers: Map<number, string>;
	waitingForCustomInput: number | null;
	messageIds: number[];
	activeMessageId: number | null;
}

// Module-level mutable state
let activeSession: SessionInfo | null = null;
let activeDirectory: string | null = null;
const accumulatedText = new Map<string, string>();
const messageRoles = new Map<string, { role: string }>();
const pendingPermissions = new Map<number, PendingPermission>();
let questionState: QuestionState | null = null;
let busy = false;

// Session
export function getSession(): SessionInfo | null {
	return activeSession;
}
export function setSession(session: SessionInfo): void {
	activeSession = session;
}

// Directory
export function getDirectory(): string | null {
	return activeDirectory;
}
export function setDirectory(dir: string): void {
	activeDirectory = dir;
}

// Accumulated text
export function getAccumulatedText(): Map<string, string> {
	return accumulatedText;
}
export function getMessages(): Map<string, { role: string }> {
	return messageRoles;
}
export function clearAccumulatedText(): void {
	accumulatedText.clear();
	messageRoles.clear();
}

// Pending permissions
export function addPendingPermission(
	messageId: number,
	permission: PendingPermission,
): void {
	pendingPermissions.set(messageId, permission);
}
export function removePendingPermission(messageId: number): void {
	pendingPermissions.delete(messageId);
}
export function getPermissionByMessageId(
	messageId: number,
): PendingPermission | undefined {
	return pendingPermissions.get(messageId);
}

// Question state
export function getQuestionState(): QuestionState | null {
	return questionState;
}
export function setQuestionState(qs: QuestionState): void {
	questionState = qs;
}
export function clearQuestionState(): void {
	questionState = null;
}

// Busy flag
export function isBusy(): boolean {
	return busy;
}
export function setBusy(value: boolean): void {
	busy = value;
}

// Clear all
export function clearAll(): void {
	activeSession = null;
	activeDirectory = null;
	accumulatedText.clear();
	messageRoles.clear();
	pendingPermissions.clear();
	questionState = null;
	busy = false;
}
