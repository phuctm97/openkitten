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
