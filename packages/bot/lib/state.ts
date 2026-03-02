import { eq } from "drizzle-orm";
import { database } from "./database";
import { profile } from "./schema";

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
	activeMessageId: number | null;
}

export interface AccumulatedFile {
	partID: string;
	url: string;
	mime: string;
	filename?: string;
	caption?: string;
}

// Module-level mutable state
const accumulatedText = new Map<string, string>();
const accumulatedFiles = new Map<string, AccumulatedFile[]>();
const pendingPermissions = new Map<number, PendingPermission>();
const processedToolCalls = new Set<string>();
let questionState: QuestionState | null = null;

// Session ID (database-backed with in-memory cache)
let cachedSessionID: string | null | undefined; // undefined = not loaded yet

export function getSessionID(): string | null {
	if (cachedSessionID === undefined) {
		const row = database
			.select({ activeSessionId: profile.activeSessionId })
			.from(profile)
			.where(eq(profile.id, 1))
			.get();
		cachedSessionID = row?.activeSessionId ?? null;
	}
	return cachedSessionID;
}
export function setSessionID(id: string): void {
	database
		.insert(profile)
		.values({ id: 1, activeSessionId: id })
		.onConflictDoUpdate({
			target: profile.id,
			set: { activeSessionId: id, updatedAt: Math.floor(Date.now() / 1000) },
		})
		.run();
	cachedSessionID = id;
}

// Accumulated text
export function getAccumulatedText(): Map<string, string> {
	return accumulatedText;
}
export function clearAccumulatedText(): void {
	accumulatedText.clear();
}

// Accumulated files
export function getAccumulatedFiles(): Map<string, AccumulatedFile[]> {
	return accumulatedFiles;
}
export function clearAccumulatedFiles(): void {
	accumulatedFiles.clear();
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
export function clearPendingPermissions(): void {
	pendingPermissions.clear();
}
export function getPermissionByMessageId(
	messageId: number,
): PendingPermission | undefined {
	return pendingPermissions.get(messageId);
}

// Processed tool calls (dedup — tool events fire for each status transition)
export function hasProcessedToolCall(callID: string): boolean {
	return processedToolCalls.has(callID);
}
export function markToolCallProcessed(callID: string): void {
	processedToolCalls.add(callID);
}
export function clearProcessedToolCalls(): void {
	processedToolCalls.clear();
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
