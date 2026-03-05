import { eq } from "drizzle-orm";
import { database } from "./database";
import { profile } from "./schema";

export interface PermissionEntry {
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

// Module-level mutable state
const accumulatedText = new Map<string, string>();
const permissionState = new Map<number, PermissionEntry>();
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

// Permission state
export function addPermissionState(
	messageId: number,
	permission: PermissionEntry,
): void {
	permissionState.set(messageId, permission);
}
export function removePermissionState(messageId: number): void {
	permissionState.delete(messageId);
}
export function clearPermissionState(): void {
	permissionState.clear();
}
export function getPermissionByMessageId(
	messageId: number,
): PermissionEntry | undefined {
	return permissionState.get(messageId);
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
