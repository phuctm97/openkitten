import { convert } from "telegram-markdown-v2";
import type { GrammyChunk } from "~/lib/grammy-chunk";
import { logger } from "~/lib/logger";
import { markdownFindCodeBlockRanges } from "~/lib/markdown-find-code-block-ranges";
import { markdownHrPattern } from "~/lib/markdown-hr-pattern";
import { markdownIsInCodeBlock } from "~/lib/markdown-is-in-code-block";
import { markdownPreserveCodeBlockLanguages } from "~/lib/markdown-preserve-code-block-languages";
import { telegramMessageMaxLength } from "~/lib/telegram-message-max-length";

const splitLength = Math.floor(telegramMessageMaxLength * 0.8);

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
    const codeBlocks = markdownFindCodeBlockRanges(remaining);
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
        if (!markdownIsInCodeBlock(candidatePos, codeBlocks)) {
          best = candidatePos;
        }
      }
      if (best > 0) splitPos = best;
    }

    if (splitPos === -1) {
      const block = markdownIsInCodeBlock(maxLength, codeBlocks);
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

function convertSingleChunk(chunk: string): GrammyChunk {
  try {
    const markdown = markdownPreserveCodeBlockLanguages(chunk, convert(chunk));
    return { text: chunk, markdown };
  } catch (error) {
    logger.warn("Failed to format as MarkdownV2", error, { chunk });
    return { text: chunk };
  }
}

function tryConvert(chunk: string): readonly GrammyChunk[] {
  const result = convertSingleChunk(chunk);
  if (result.markdown === undefined) return [result];
  if (result.markdown.length <= telegramMessageMaxLength) return [result];

  // MarkdownV2 escaping expanded the text beyond Telegram's limit.
  // Re-split the source at a smaller size estimated from the expansion ratio.
  const ratio = telegramMessageMaxLength / result.markdown.length;
  const smallerLimit = Math.floor(chunk.length * ratio * 0.9);
  const subChunks = splitMessage(chunk, smallerLimit);
  const results: GrammyChunk[] = [];
  for (const sub of subChunks) {
    const subResult = convertSingleChunk(sub);
    if (
      subResult.markdown !== undefined &&
      subResult.markdown.length <= telegramMessageMaxLength
    ) {
      results.push(subResult);
    } else {
      results.push({ text: sub });
    }
  }
  return results;
}

export function grammyFormatText(text: string): readonly GrammyChunk[] {
  const sections = text.split(markdownHrPattern);
  const results: GrammyChunk[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const chunks = splitMessage(trimmed, splitLength);
    for (const chunk of chunks) {
      results.push(...tryConvert(chunk));
    }
  }

  return results;
}
