export function normalizeCallback(callback?: string | null): string {
  if (!callback) return "/";
  try {
    const { pathname, search, hash } = new URL(
      callback,
      window.location.origin,
    );
    return `${pathname}${search}${hash}`;
  } catch {
    return "/";
  }
}
