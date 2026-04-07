import { convert } from "telegram-markdown-v2";
import type { GrammyChunk } from "~/lib/grammy-chunk";
import { logger } from "~/lib/logger";

const telegramMaxLength = 4096;
const telegramSplitLength = Math.floor(telegramMaxLength * 0.8);

interface CodeBlockRange {
  readonly start: number;
  readonly end: number;
  readonly lang: string;
}

function findCodeBlockRanges(text: string): readonly CodeBlockRange[] {
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
  ranges: readonly CodeBlockRange[],
): CodeBlockRange | null {
  for (const range of ranges) {
    if (pos > range.start && pos < range.end) return range;
  }
  return null;
}

interface SplitPriority {
  readonly pattern: RegExp;
  readonly offset: number;
}

const splitPriorities: readonly SplitPriority[] = [
  { pattern: /\n(?=#{1,6} |---|___|\*\*\*)/g, offset: 0 },
  { pattern: /\n\n/g, offset: 0 },
  { pattern: /\n(?=[-*] |\d+\. )/g, offset: 0 },
  { pattern: /\n/g, offset: 0 },
  { pattern: /[.!?] /g, offset: 1 },
  { pattern: / /g, offset: 0 },
];

function splitMessage(text: string, maxLength: number): readonly string[] {
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

function extractCodeBlockLangs(text: string): readonly string[] {
  return Array.from(text.matchAll(/^```(\w+)/gm), (m) => m[0].slice(3));
}

function restoreCodeBlockLangs(text: string, langs: readonly string[]): string {
  if (langs.length === 0) return text;
  let i = 0;
  let open = false;
  return text.replace(/^```$/gm, () => {
    open = !open;
    return open && i < langs.length ? `\`\`\`${langs[i++]}` : "```";
  });
}

function stripTables(text: string): string {
  const codeBlocks = findCodeBlockRanges(text);
  const lines = text.split("\n");
  const result: string[] = [];
  let inTable = false;
  let headers: string[] = [];
  let pos = 0;

  for (const line of lines) {
    const lineStart = pos;
    pos += line.length + 1;
    if (isInCodeBlock(lineStart, codeBlocks)) {
      result.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (/^\|.*\|$/.test(trimmed)) {
      if (/^\|[\s:|-]+\|$/.test(trimmed)) continue;
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      if (!inTable) {
        headers = cells;
        inTable = true;
      } else {
        const parts = cells.map((cell, i) =>
          headers[i] ? `${headers[i]}: ${cell}` : cell,
        );
        result.push(`• ${parts.join(" | ")}`);
      }
    } else {
      if (inTable && headers.length > 0) {
        result.push(`• ${headers.join(" | ")}`);
      }
      inTable = false;
      headers = [];
      result.push(line);
    }
  }
  if (inTable && headers.length > 0) {
    result.push(`• ${headers.join(" | ")}`);
  }

  return result.join("\n");
}

function convertSingleChunk(chunk: string): GrammyChunk {
  try {
    const cleaned = stripTables(chunk);
    const langs = extractCodeBlockLangs(cleaned);
    const markdown = restoreCodeBlockLangs(convert(cleaned), langs);
    return { text: chunk, markdown };
  } catch (error) {
    logger.warn("Failed to format as MarkdownV2", error, { chunk });
    return { text: chunk };
  }
}

function tryConvert(chunk: string): readonly GrammyChunk[] {
  const result = convertSingleChunk(chunk);
  if (result.markdown === undefined) return [result];
  if (result.markdown.length <= telegramMaxLength) return [result];

  // MarkdownV2 escaping expanded the text beyond Telegram's limit.
  // Re-split the source at a smaller size estimated from the expansion ratio.
  const ratio = telegramMaxLength / result.markdown.length;
  const smallerLimit = Math.floor(chunk.length * ratio * 0.9);
  const subChunks = splitMessage(chunk, smallerLimit);
  const results: GrammyChunk[] = [];
  for (const sub of subChunks) {
    const subResult = convertSingleChunk(sub);
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
}

const hrPattern = /(?:^|\n)[ \t]*(?:---+|___+|\*\*\*+)[ \t]*(?:\n|$)/;

export function grammyFormatText(text: string): readonly GrammyChunk[] {
  const sections = text.split(hrPattern);
  const results: GrammyChunk[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const chunks = splitMessage(trimmed, telegramSplitLength);
    for (const chunk of chunks) {
      results.push(...tryConvert(chunk));
    }
  }

  return results;
}
