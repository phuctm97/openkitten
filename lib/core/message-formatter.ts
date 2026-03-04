/** Content-aware message splitting (NanoClaw algorithm). Pure, no IO. */

export const TELEGRAM_MAX_LENGTH = 4096;
/** 80% of max — headroom for MarkdownV2 escaping overhead */
export const TELEGRAM_SPLIT_LENGTH = Math.floor(TELEGRAM_MAX_LENGTH * 0.8); // 3276

// ── Code block detection ────────────────────────────────────────────────────

interface CodeBlockRange {
	start: number;
	end: number;
	lang: string;
}

export function findCodeBlockRanges(text: string): CodeBlockRange[] {
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

export function isInCodeBlock(
	pos: number,
	ranges: CodeBlockRange[],
): CodeBlockRange | null {
	for (const range of ranges) {
		if (pos > range.start && pos < range.end) return range;
	}
	return null;
}

// ── Split priorities ────────────────────────────────────────────────────────

const SPLIT_PRIORITIES: ReadonlyArray<{ pattern: RegExp; offset: number }> = [
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

// ── Split algorithm ─────────────────────────────────────────────────────────

export function splitMessage(text: string, maxLength: number): string[] {
	if (text.length <= maxLength) return [text];

	const chunks: string[] = [];
	let remaining = text;

	while (remaining.length > maxLength) {
		const codeBlocks = findCodeBlockRanges(remaining);
		let splitPos = -1;

		for (const { pattern, offset } of SPLIT_PRIORITIES) {
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

// ── Horizontal rule pre-splitting ───────────────────────────────────────────

const HR_PATTERN = /(?:^|\n)\s*(?:---+|___+|\*\*\*+)\s*(?:\n|$)/g;

export function splitOnHorizontalRules(text: string): string[] {
	const sections = text.split(HR_PATTERN);
	return sections.map((s) => s.trim()).filter((s) => s.length > 0);
}
