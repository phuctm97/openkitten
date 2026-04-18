import { beforeEach, expect, test, vi } from "vitest";

import { mockSonnerToast } from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("toasts nested auth error messages before falling back to top-level ones", async () => {
  const toast = mockSonnerToast();
  const { toastAuthError } = await import("~/lib/auth-errors");

  toastAuthError({
    error: { message: "Nested message" },
    message: "Top-level message",
  });
  toastAuthError({
    message: "Top-level message",
  });

  expect(toast.toastError).toHaveBeenCalledWith("Nested message");
  expect(toast.toastError).toHaveBeenCalledWith("Top-level message");
});

test("toasts query errors when present and always returns false", async () => {
  const toast = mockSonnerToast();
  const { toastQueryError } = await import("~/lib/auth-errors");

  expect(
    toastQueryError({
      error: { message: "Query failed" },
    }),
  ).toBe(false);
  expect(
    toastQueryError({
      error: {},
    }),
  ).toBe(false);

  expect(toast.toastError).toHaveBeenCalledTimes(1);
  expect(toast.toastError).toHaveBeenCalledWith("Query failed");
});

test("ignores auth errors without any message", async () => {
  const toast = mockSonnerToast();
  const { toastAuthError } = await import("~/lib/auth-errors");

  toastAuthError({});

  expect(toast.toastError).not.toHaveBeenCalled();
});
