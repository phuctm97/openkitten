export function opencodeCheckGoneError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return "name" in error && error.name === "NotFoundError";
}
