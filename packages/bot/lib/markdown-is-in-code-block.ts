interface MarkdownCodeBlockRange {
  readonly start: number;
  readonly end: number;
  readonly lang: string;
}

export function markdownIsInCodeBlock(
  pos: number,
  ranges: readonly MarkdownCodeBlockRange[],
): MarkdownCodeBlockRange | null {
  for (const range of ranges) {
    if (pos > range.start && pos < range.end) return range;
  }
  return null;
}
