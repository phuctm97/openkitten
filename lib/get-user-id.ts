export function getUserId(): number {
  const getuid = process.getuid;
  if (!getuid) throw new Error("process.getuid is not available");
  return getuid();
}
