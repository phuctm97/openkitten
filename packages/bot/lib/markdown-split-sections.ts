import { markdownFindCodeBlockRanges } from "~/lib/markdown-find-code-block-ranges";
import { markdownHrPattern } from "~/lib/markdown-hr-pattern";
import { markdownIsInCodeBlock } from "~/lib/markdown-is-in-code-block";

const markdownHrMarkerPattern = /---+|___+|\*\*\*+/;

export function markdownSplitSections(text: string): readonly string[] {
  const ranges = markdownFindCodeBlockRanges(text);
  const pattern = new RegExp(markdownHrPattern.source, "g");
  const sections: string[] = [];
  let sectionStart = 0;

  for (
    let match = pattern.exec(text);
    match !== null;
    match = pattern.exec(text)
  ) {
    const markerOffset = match[0].search(markdownHrMarkerPattern);
    const markerStart = match.index + markerOffset;
    if (markdownIsInCodeBlock(markerStart, ranges)) continue;

    sections.push(text.slice(sectionStart, match.index));
    sectionStart = match.index + match[0].length;
  }

  sections.push(text.slice(sectionStart));
  return sections;
}
