import { convert } from "telegram-markdown-v2";
import type { GrammyChunk } from "~/lib/grammy-chunk";
import { logger } from "~/lib/logger";

const telegramMaxLength = 4096;
const trimAggressionFactor = 0.92;
const maxTrimAttempts = 24;
const hrPattern = /(?:^|\n)[ \t]*(?:---+|___+|\*\*\*+)[ \t]*(?:\n|$)/;

interface CodeBlockRange {
  readonly start: number;
  readonly end: number;
  readonly lang: string;
}

interface SilentConvertResult {
  readonly markdown?: string | undefined;
  readonly error?: unknown;
}

interface TrimPriority {
  readonly pattern: RegExp;
  readonly offset: number;
}

const trimPriorities: readonly TrimPriority[] = [
  { pattern: /\n(?=#{1,6} |---|___|\*\*\*)/g, offset: 1 },
  { pattern: /\n\n/g, offset: 2 },
  { pattern: /\n(?=[-*] |\d+\. )/g, offset: 1 },
  { pattern: /\n/g, offset: 1 },
  { pattern: /[.!?] /g, offset: 2 },
  { pattern: / /g, offset: 1 },
];

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

function extractCodeBlockLangs(text: string): readonly string[] {
  return Array.from(text.matchAll(/^```(\w+)/gm), (match) => match[0].slice(3));
}

function restoreCodeBlockLangs(text: string, langs: readonly string[]): string {
  if (langs.length === 0) return text;
  let index = 0;
  let open = false;
  return text.replace(/^```$/gm, () => {
    open = !open;
    return open && index < langs.length ? `\`\`\`${langs[index++]}` : "```";
  });
}

function getLastSection(text: string): string {
  const sections = text.split(hrPattern);
  for (let index = sections.length - 1; index >= 0; index -= 1) {
    const section = sections[index]?.trim();
    if (section) return section;
  }
  return "";
}

function findNaturalTrimStart(
  text: string,
  minStart: number,
  ranges: readonly CodeBlockRange[],
): number | undefined {
  for (const { pattern, offset } of trimPriorities) {
    const searchRegex = new RegExp(pattern.source, pattern.flags);
    for (
      let match = searchRegex.exec(text);
      match !== null;
      match = searchRegex.exec(text)
    ) {
      const candidate = match.index + offset;
      if (candidate < minStart) continue;
      if (!isInCodeBlock(candidate, ranges)) return candidate;
    }
  }
  return undefined;
}

function alignCodeBlockTrimStart(
  text: string,
  maxLength: number,
  start: number,
  range: CodeBlockRange,
): number {
  const reopenPrefix = `\`\`\`${range.lang}\n`;
  const available = Math.max(1, maxLength - reopenPrefix.length);
  let nextStart = Math.max(start, text.length - available);

  if (nextStart > range.start && text[nextStart - 1] !== "\n") {
    const nextNewline = text.indexOf("\n", nextStart);
    if (nextNewline >= 0 && nextNewline < range.end) {
      const lineStart = nextNewline + 1;
      if (reopenPrefix.length + text.length - lineStart <= maxLength) {
        nextStart = lineStart;
      }
    }
  }

  while (text[nextStart] === "\n") nextStart += 1;
  return nextStart;
}

function trimTailChunk(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const ranges = findCodeBlockRanges(text);
  const minStart = text.length - maxLength;
  let start = findNaturalTrimStart(text, minStart, ranges) ?? minStart;

  const range = isInCodeBlock(start, ranges);
  if (range) {
    start = alignCodeBlockTrimStart(text, maxLength, start, range);
    return `\`\`\`${range.lang}\n${text.slice(start)}`;
  }

  return text.slice(start).trimStart();
}

function convertSingleChunkSilently(chunk: string): SilentConvertResult {
  try {
    const langs = extractCodeBlockLangs(chunk);
    return { markdown: restoreCodeBlockLangs(convert(chunk), langs) };
  } catch (error) {
    return { error };
  }
}

function nextTrimLength(
  currentLength: number,
  chunkText: string,
  markdown: string | undefined,
): number {
  if (currentLength <= 1) return 0;

  if (markdown !== undefined && markdown.length > telegramMaxLength) {
    const ratio = telegramMaxLength / markdown.length;
    const nextLength = Math.floor(
      chunkText.length * ratio * trimAggressionFactor,
    );
    return Math.max(1, Math.min(currentLength - 1, nextLength));
  }

  return Math.max(
    1,
    Math.min(currentLength - 1, Math.floor(currentLength * 0.9)),
  );
}

export function grammyFormatDraft(text: string): GrammyChunk {
  const section = getLastSection(text);
  if (!section) return { text: "" };

  let trimLength = Math.min(section.length, telegramMaxLength);
  const fallbackText = trimTailChunk(section, telegramMaxLength);
  let previousChunk: string | undefined;
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt < maxTrimAttempts && trimLength > 0;
    attempt += 1
  ) {
    const chunkText = trimTailChunk(section, trimLength);

    const result = convertSingleChunkSilently(chunkText);
    if (result.error !== undefined) lastError = result.error;

    if (
      result.markdown !== undefined &&
      result.markdown.length <= telegramMaxLength
    ) {
      return { text: chunkText, markdown: result.markdown };
    }

    const nextLength = nextTrimLength(trimLength, chunkText, result.markdown);
    if (chunkText === previousChunk) {
      trimLength = Math.max(0, trimLength - 1);
    } else {
      trimLength = nextLength;
    }
    previousChunk = chunkText;
  }

  if (lastError !== undefined) {
    logger.warn("Failed to format draft as MarkdownV2", lastError, {
      chunk: fallbackText,
    });
  }

  return { text: fallbackText };
}
