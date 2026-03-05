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
