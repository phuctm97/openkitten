export function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}
