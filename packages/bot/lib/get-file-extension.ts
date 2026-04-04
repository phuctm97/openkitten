export function getFileExtension(filename: string): string | undefined {
  const index = filename.lastIndexOf(".");
  if (index < 0 || index === filename.length - 1) return undefined;
  return filename.slice(index + 1).toLowerCase();
}
