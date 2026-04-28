const fallbackErrorMessage = "Something went wrong";

function isNonEmptyMessage(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function formatError(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return fallbackErrorMessage;
  }

  if ("error" in error) {
    const nestedError = error.error;

    if (
      typeof nestedError === "object" &&
      nestedError !== null &&
      "message" in nestedError &&
      isNonEmptyMessage(nestedError.message)
    ) {
      return nestedError.message;
    }
  }

  if ("message" in error && isNonEmptyMessage(error.message)) {
    return error.message;
  }

  return fallbackErrorMessage;
}
