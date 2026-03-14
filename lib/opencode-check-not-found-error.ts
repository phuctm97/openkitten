// Checks if an opencode SDK error is a NotFoundError (404). This means
// the specific request/resource no longer exists on the server — it does
// NOT imply the session or chat is gone. Used to silently skip already-
// resolved prompts during dismiss.
export function opencodeCheckNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return "name" in error && error.name === "NotFoundError";
}
