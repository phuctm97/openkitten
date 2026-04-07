function markdownExtractCodeBlockLanguages(text: string): readonly string[] {
  return Array.from(text.matchAll(/^```(\w+)/gm), (match) => match[0].slice(3));
}

export function markdownPreserveCodeBlockLanguages(
  source: string,
  text: string,
): string {
  const languages = markdownExtractCodeBlockLanguages(source);
  if (languages.length === 0) return text;

  let index = 0;
  let open = false;
  return text.replace(/^```$/gm, () => {
    open = !open;
    return open && index < languages.length
      ? `\`\`\`${languages[index++]}`
      : "```";
  });
}
