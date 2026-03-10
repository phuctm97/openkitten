import { Effect } from "effect";
import { convert } from "telegram-markdown-v2";

export interface MessageChunk {
  text: string;
  markdown?: string | undefined;
}

const telegramMaxLength = 4096;
const telegramSplitLength = Math.floor(telegramMaxLength * 0.8); // 3276

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
      openLang = match[0].slice(3);
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

// Split candidates ordered from most to least desirable break point.
// Offset shifts the split position past the matched delimiter (e.g. after
// sentence-ending punctuation so the period stays with its sentence).
const splitPriorities: ReadonlyArray<{ pattern: RegExp; offset: number }> = [
  { pattern: /\n(?=#{1,6} |---|___|\*\*\*)/g, offset: 0 }, // before headings/HRs
  { pattern: /\n\n/g, offset: 0 }, // paragraph breaks
  { pattern: /\n(?=[-*] |\d+\. )/g, offset: 0 }, // before list items
  { pattern: /\n/g, offset: 0 }, // any newline
  { pattern: /[.!?] /g, offset: 1 }, // sentence boundaries
  { pattern: / /g, offset: 0 }, // word boundaries
];

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    const codeBlocks = findCodeBlockRanges(remaining);
    let splitPos = -1;

    for (const { pattern, offset } of splitPriorities) {
      if (splitPos !== -1) break;

      let best = -1;
      const searchRegex = new RegExp(pattern.source, pattern.flags);
      for (
        let m = searchRegex.exec(remaining);
        m !== null;
        m = searchRegex.exec(remaining)
      ) {
        const candidatePos = m.index + offset;
        if (candidatePos >= maxLength) break;
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

  chunks.push(remaining);
  return chunks;
}

// --- Formatting pipeline ---

const hrPattern = /(?:^|\n)[ \t]*(?:---+|___+|\*\*\*+)[ \t]*(?:\n|$)/;

function extractCodeBlockLangs(text: string): string[] {
  return Array.from(text.matchAll(/^```(\w+)/gm), (m) => m[0].slice(3));
}

function restoreCodeBlockLangs(text: string, langs: string[]): string {
  if (langs.length === 0) return text;
  let i = 0;
  let open = false;
  return text.replace(/^```$/gm, () => {
    open = !open;
    return open && i < langs.length ? `\`\`\`${langs[i++]}` : "```";
  });
}

/** Converts a single chunk, logging and falling back to plain text on error. */
function convertSingleChunk(chunk: string) {
  return Effect.try(() => {
    const langs = extractCodeBlockLangs(chunk);
    const markdown = restoreCodeBlockLangs(convert(chunk), langs);
    return { text: chunk, markdown };
  }).pipe(
    Effect.catchAll((error) =>
      Effect.logDebug(error).pipe(
        Effect.annotateLogs("debugHint", "formatMessage"),
        Effect.as({ text: chunk, markdown: undefined }),
      ),
    ),
  );
}

/** Converts a chunk to MarkdownV2, re-splitting if escaping blows the limit. */
function tryConvert(chunk: string) {
  return Effect.gen(function* () {
    const result = yield* convertSingleChunk(chunk);
    // Convert failed — already logged, fall back to plain text
    if (result.markdown === undefined) return [result];
    // Fits within Telegram limit
    if (result.markdown.length <= telegramMaxLength) return [result];

    // MarkdownV2 escaping expanded beyond the limit — re-split proportionally
    const ratio = telegramMaxLength / result.markdown.length;
    const smallerLimit = Math.floor(chunk.length * ratio * 0.9);
    const subChunks = splitMessage(chunk, smallerLimit);
    const results: MessageChunk[] = [];
    for (const sub of subChunks) {
      const subResult = yield* convertSingleChunk(sub);
      if (
        subResult.markdown !== undefined &&
        subResult.markdown.length <= telegramMaxLength
      ) {
        results.push(subResult);
      } else {
        results.push({ text: sub });
      }
    }
    return results;
  });
}

/** Splits text on HRs, chunks to Telegram's limit, and converts to MarkdownV2. */
export function formatMessage(text: string) {
  return Effect.gen(function* () {
    const sections = text.split(hrPattern);
    const results: MessageChunk[] = [];

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      const chunks = splitMessage(trimmed, telegramSplitLength);
      for (const chunk of chunks) {
        results.push(...(yield* tryConvert(chunk)));
      }
    }

    return results;
  });
}
