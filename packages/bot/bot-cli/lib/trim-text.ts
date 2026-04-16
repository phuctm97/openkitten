export function trimText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}
