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
let activeSessionID: string | null = null;
const accumulatedText = new Map<string, string>();
const pendingPermissions = new Map<number, PendingPermission>();
let questionState: QuestionState | null = null;

// Session ID
export function getSessionID(): string | null {
	return activeSessionID;
}
export function setSessionID(id: string): void {
	activeSessionID = id;
}

// Accumulated text
export function getAccumulatedText(): Map<string, string> {
	return accumulatedText;
}
export function clearAccumulatedText(): void {
	accumulatedText.clear();
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

// Clear all
export function clearAll(): void {
	activeSessionID = null;
	accumulatedText.clear();
	pendingPermissions.clear();
	questionState = null;
}
