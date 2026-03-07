import { convert } from "telegram-markdown-v2";

export interface MessageChunk {
  text: string;
  formatted: boolean;
}

const TELEGRAM_MAX_LENGTH = 4096;
const TELEGRAM_SPLIT_LENGTH = Math.floor(TELEGRAM_MAX_LENGTH * 0.8); // 3276

// --- Content-aware message splitting ---

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

const SPLIT_PRIORITIES: ReadonlyArray<{ pattern: RegExp; offset: number }> = [
  { pattern: /\n(?=#{1,6} |---|___|\*\*\*)/g, offset: 0 },
  { pattern: /\n\n/g, offset: 0 },
  { pattern: /\n(?=[-*] |\d+\. )/g, offset: 0 },
  { pattern: /\n/g, offset: 0 },
  { pattern: /[.!?] /g, offset: 1 },
  { pattern: / /g, offset: 0 },
];

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

// --- Formatting pipeline ---

const HR_PATTERN = /(?:^|\n)[ \t]*(?:---+|___+|\*\*\*+)[ \t]*(?:\n|$)/;

function tryConvert(chunk: string): MessageChunk[] {
  try {
    const formatted = convert(chunk);
    if (formatted.length <= TELEGRAM_MAX_LENGTH) {
      return [{ text: formatted, formatted: true }];
    }

    // MarkdownV2 escaping expanded beyond the limit — re-split proportionally
    const ratio = TELEGRAM_MAX_LENGTH / formatted.length;
    const smallerLimit = Math.floor(chunk.length * ratio * 0.9);
    const subChunks = splitMessage(chunk, smallerLimit);
    const results: MessageChunk[] = [];

    for (const sub of subChunks) {
      try {
        const subFormatted = convert(sub);
        if (subFormatted.length <= TELEGRAM_MAX_LENGTH) {
          results.push({ text: subFormatted, formatted: true });
        } else {
          results.push({ text: sub, formatted: false });
        }
      } catch {
        results.push({ text: sub, formatted: false });
      }
    }

    return results;
  } catch {
    return [{ text: chunk, formatted: false }];
  }
}

export function formatMessage(text: string): MessageChunk[] {
  const sections = text.split(HR_PATTERN);
  const results: MessageChunk[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const chunks = splitMessage(trimmed, TELEGRAM_SPLIT_LENGTH);
    for (const chunk of chunks) {
      results.push(...tryConvert(chunk));
    }
  }

  return results;
}
