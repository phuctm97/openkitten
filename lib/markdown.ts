import type { Api } from "grammy";
import { convert } from "telegram-markdown-v2";
import {
	TELEGRAM_MAX_MESSAGE_LENGTH,
	TELEGRAM_RESPLIT_SAFETY_FACTOR,
	TELEGRAM_SPLIT_MESSAGE_LENGTH,
	TELEGRAM_SPLIT_MESSAGE_PRIORITIES,
} from "~/lib/constants/telegram";

// --- Content-aware message splitting (ported from NanoClaw) ---

interface CodeBlockRange {
	start: number;
	end: number;
	lang: string;
}

function findCodeBlockRanges(text: string): CodeBlockRange[] {
	const ranges: CodeBlockRange[] = [];
	const regex = /^```(\w*)/gm;
	let openStart: number | null = null;
	let openLang = "";

	for (let match = regex.exec(text); match !== null; match = regex.exec(text)) {
		if (openStart === null) {
			openStart = match.index;
			openLang = match[1] ?? "";
		} else {
			ranges.push({
				start: openStart,
				end: match.index + match[0].length,
				lang: openLang,
			});
			openStart = null;
			openLang = "";
		}
	}

	// Unclosed block extends to end of text
	if (openStart !== null) {
		ranges.push({ start: openStart, end: text.length, lang: openLang });
	}

	return ranges;
}

function isInCodeBlock(
	pos: number,
	ranges: CodeBlockRange[],
): CodeBlockRange | null {
	for (const range of ranges) {
		if (pos > range.start && pos < range.end) return range;
	}
	return null;
}

export function splitMessage(text: string, maxLength: number): string[] {
	if (text.length <= maxLength) return [text];

	const chunks: string[] = [];
	let remaining = text;

	while (remaining.length > maxLength) {
		const codeBlocks = findCodeBlockRanges(remaining);
		let splitPos = -1;

		for (const { pattern, offset } of TELEGRAM_SPLIT_MESSAGE_PRIORITIES) {
			if (splitPos !== -1) break;

			let best = -1;
			const searchRegex = new RegExp(pattern.source, pattern.flags);
			for (
				let m = searchRegex.exec(remaining);
				m !== null;
				m = searchRegex.exec(remaining)
			) {
				const candidatePos = m.index + offset;
				if (candidatePos <= 0 || candidatePos >= maxLength) {
					if (candidatePos >= maxLength) break;
					continue;
				}
				if (!isInCodeBlock(candidatePos, codeBlocks)) {
					best = candidatePos;
				}
			}
			if (best > 0) splitPos = best;
		}

		// If no valid split point found outside code blocks, split inside code block
		if (splitPos === -1) {
			const block = isInCodeBlock(maxLength, codeBlocks);
			if (block) {
				let bestNewline = -1;
				for (let i = maxLength - 1; i > block.start; i--) {
					if (remaining[i] === "\n") {
						bestNewline = i;
						break;
					}
				}

				const reopenPrefix = `\`\`\`${block.lang}\n`;
				if (bestNewline > block.start && bestNewline > reopenPrefix.length) {
					const chunk = `${remaining.slice(0, bestNewline).trimEnd()}\n\`\`\``;
					chunks.push(chunk);
					remaining = reopenPrefix + remaining.slice(bestNewline + 1);
					continue;
				}
			}

			// Hard cut as ultimate fallback
			splitPos = maxLength;
		}

		const chunk = remaining.slice(0, splitPos).trimEnd();
		chunks.push(chunk);
		remaining = remaining.slice(splitPos).trimStart();
	}

	if (remaining.length > 0) {
		chunks.push(remaining);
	}

	return chunks;
}

// --- MarkdownV2 conversion helpers ---

/**
 * Try converting to MarkdownV2; fall back to plain text if conversion fails
 * or result exceeds Telegram's limit. For single messages (questions, permissions).
 */
export function convertWithFallback(text: string): {
	text: string;
	parseMode?: "MarkdownV2";
} {
	try {
		const formatted = convert(text);
		if (formatted.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
			return { text: formatted, parseMode: "MarkdownV2" };
		}
	} catch {
		// fall through to plain text
	}
	return { text };
}

/**
 * Split text content-aware, convert each chunk to MarkdownV2, and send.
 * Falls back to plain text per-chunk if conversion fails or exceeds limit.
 */
export async function sendFormattedMessage(
	api: Api,
	chatId: number,
	text: string,
): Promise<void> {
	// Layer 0: Pre-split on horizontal rules — Telegram has no HR support,
	// so each section becomes a separate message for visual separation.
	const sections = text.split(
		/(?:^|\n)[ \t]*(?:---+|___+|\*\*\*+)[ \t]*(?:\n|$)/,
	);

	for (const section of sections) {
		const trimmed = section.trim();
		if (!trimmed) continue;

		const chunks = splitMessage(trimmed, TELEGRAM_SPLIT_MESSAGE_LENGTH);

		for (const chunk of chunks) {
			let parts: string[];
			try {
				const formatted = convert(chunk);
				if (formatted.length > TELEGRAM_MAX_MESSAGE_LENGTH) {
					// Layer 2: MarkdownV2 escaping expanded beyond the limit —
					// re-split proportionally to preserve formatting.
					const ratio = TELEGRAM_MAX_MESSAGE_LENGTH / formatted.length;
					const smallerLimit = Math.floor(
						chunk.length * ratio * TELEGRAM_RESPLIT_SAFETY_FACTOR,
					);
					parts = splitMessage(chunk, smallerLimit);
				} else {
					await api.sendMessage(chatId, formatted, {
						parse_mode: "MarkdownV2",
						link_preview_options: { is_disabled: true },
					});
					continue;
				}
			} catch {
				// Layer 3: convert() failed — send original chunk as plain text
				await api.sendMessage(chatId, chunk, {
					link_preview_options: { is_disabled: true },
				});
				continue;
			}

			// Send each sub-chunk independently so a failure doesn't duplicate earlier ones
			for (const sub of parts) {
				try {
					const subFormatted = convert(sub);
					if (subFormatted.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
						await api.sendMessage(chatId, subFormatted, {
							parse_mode: "MarkdownV2",
							link_preview_options: { is_disabled: true },
						});
					} else {
						await api.sendMessage(chatId, sub, {
							link_preview_options: { is_disabled: true },
						});
					}
				} catch {
					await api.sendMessage(chatId, sub, {
						link_preview_options: { is_disabled: true },
					});
				}
			}
		}
	}
}
