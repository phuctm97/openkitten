/** Telegram Bot API hard limits and derived thresholds */

/** Maximum length of a single message (characters) */
export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

/** Headroom for MarkdownV2 escaping overhead (80% of max) */
export const TELEGRAM_SPLIT_MESSAGE_LENGTH = Math.floor(
	TELEGRAM_MAX_MESSAGE_LENGTH * 0.8,
);

/** Maximum file size the Bot API accepts for uploads */
export const TELEGRAM_MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Timeout for downloading files from Telegram servers (ms) */
export const TELEGRAM_DOWNLOAD_TIMEOUT_MS = 60_000;

/** User-facing error when an upload exceeds the 20 MB Bot API limit */
export const TELEGRAM_FILE_TOO_LARGE_MESSAGE = "File too large (max 20MB).";

/** Interval between "typing…" indicator pings (ms) */
export const TELEGRAM_TYPING_INTERVAL_MS = 4000;

/** Max characters for inline-keyboard button labels */
export const TELEGRAM_QUESTION_LABEL_MAX_LENGTH = 60;

/** Safety factor when re-splitting after MarkdownV2 escaping blows up */
export const TELEGRAM_RESPLIT_SAFETY_FACTOR = 0.9;

/** Split priority: prefer breaking at higher-priority markdown boundaries. */
export const TELEGRAM_SPLIT_MESSAGE_PRIORITIES: ReadonlyArray<{
	pattern: RegExp;
	offset: number;
}> = [
	// 1. Before markdown header or horizontal rule
	{ pattern: /\n(?=#{1,6} |---|___|\*\*\*)/g, offset: 0 },
	// 2. Double newline (paragraph break)
	{ pattern: /\n\n/g, offset: 0 },
	// 3. Before list item
	{ pattern: /\n(?=[-*] |\d+\. )/g, offset: 0 },
	// 4. Single newline
	{ pattern: /\n/g, offset: 0 },
	// 5. Sentence ending
	{ pattern: /[.!?] /g, offset: 1 },
	// 6. Word boundary (space)
	{ pattern: / /g, offset: 0 },
];
