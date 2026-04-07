interface MarkdownCodeBlockRange {
  readonly start: number;
  readonly end: number;
  readonly lang: string;
}

export function markdownFindCodeBlockRanges(
  text: string,
): readonly MarkdownCodeBlockRange[] {
  const ranges: MarkdownCodeBlockRange[] = [];
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
