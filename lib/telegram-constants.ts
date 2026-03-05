/** Telegram Bot API hard limits and derived thresholds */

/** Maximum length of a single message (characters) */
export const TELEGRAM_MESSAGE_MAX_LENGTH = 4096;

/** Headroom for MarkdownV2 escaping overhead (80% of max) */
export const TELEGRAM_MESSAGE_CHUNK_LENGTH = Math.floor(
	TELEGRAM_MESSAGE_MAX_LENGTH * 0.8,
);

/** Maximum file size the Bot API accepts for uploads */
export const TELEGRAM_FILE_MAX_SIZE = 20 * 1024 * 1024;

/** Timeout for downloading files from Telegram servers (ms) */
export const TELEGRAM_DOWNLOAD_TIMEOUT_MS = 60_000;
