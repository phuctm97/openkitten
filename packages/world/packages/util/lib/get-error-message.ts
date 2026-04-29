const fallbackErrorMessage = "Something went wrong";

function isNonEmptyMessage(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function getErrorMessage(error: unknown): string {
  if (isNonEmptyMessage(error)) return error;
  if (typeof error !== "object" || error === null) return fallbackErrorMessage;
  if (
    "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "message" in error.error &&
    isNonEmptyMessage(error.error.message)
  ) {
    return error.error.message;
  }
  if ("message" in error && isNonEmptyMessage(error.message)) {
    return error.message;
  }
  return fallbackErrorMessage;
}
