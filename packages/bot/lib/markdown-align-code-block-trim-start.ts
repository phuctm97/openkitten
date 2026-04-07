interface MarkdownCodeBlockRange {
  readonly start: number;
  readonly end: number;
  readonly lang: string;
}

export function markdownAlignCodeBlockTrimStart(
  text: string,
  maxLength: number,
  start: number,
  range: MarkdownCodeBlockRange,
): number {
  const reopenPrefix = `\`\`\`${range.lang}\n`;
  const available = Math.max(1, maxLength - reopenPrefix.length);
  let nextStart = Math.max(start, text.length - available);
  const nextNewline = text.indexOf("\n", nextStart);
  const lineStart = nextNewline + 1;
  const canAdvance =
    nextStart > range.start &&
    text[nextStart - 1] !== "\n" &&
    nextNewline >= 0 &&
    nextNewline < range.end &&
    reopenPrefix.length + text.length - lineStart <= maxLength;
  if (canAdvance) nextStart = lineStart;
  while (text[nextStart] === "\n") nextStart += 1;
  return nextStart;
}
