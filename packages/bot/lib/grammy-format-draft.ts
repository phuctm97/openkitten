import { convert } from "telegram-markdown-v2";
import type { GrammyChunk } from "~/lib/grammy-chunk";
import { logger } from "~/lib/logger";
import { markdownFindCodeBlockRanges } from "~/lib/markdown-find-code-block-ranges";
import { markdownIsInCodeBlock } from "~/lib/markdown-is-in-code-block";
import { markdownPreserveCodeBlockLanguages } from "~/lib/markdown-preserve-code-block-languages";
import { markdownSplitSections } from "~/lib/markdown-split-sections";
import { telegramMessageMaxLength } from "~/lib/telegram-message-max-length";

const trimAggressionFactor = 0.92;
const maxTrimAttempts = 24;

interface SilentConvertResult {
  readonly markdown?: string | undefined;
  readonly error?: unknown;
}

type CodeBlockRange = ReturnType<typeof markdownFindCodeBlockRanges>[number];

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

function getLastSection(text: string): string {
  const sections = markdownSplitSections(text);
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
      if (!markdownIsInCodeBlock(candidate, ranges)) return candidate;
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

  const ranges = markdownFindCodeBlockRanges(text);
  const minStart = text.length - maxLength;
  let start = findNaturalTrimStart(text, minStart, ranges) ?? minStart;

  const range = markdownIsInCodeBlock(start, ranges);
  if (range) {
    start = alignCodeBlockTrimStart(text, maxLength, start, range);
    return `\`\`\`${range.lang}\n${text.slice(start)}`;
  }

  return text.slice(start).trimStart();
}

function convertSingleChunkSilently(chunk: string): SilentConvertResult {
  try {
    return {
      markdown: markdownPreserveCodeBlockLanguages(chunk, convert(chunk)),
    };
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

  if (markdown !== undefined && markdown.length > telegramMessageMaxLength) {
    const ratio = telegramMessageMaxLength / markdown.length;
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

  let trimLength = Math.min(section.length, telegramMessageMaxLength);
  const fallbackText = trimTailChunk(section, telegramMessageMaxLength);
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
      result.markdown.length <= telegramMessageMaxLength
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
