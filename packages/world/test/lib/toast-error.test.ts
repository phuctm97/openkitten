import { beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

test("toasts the resolved error message", async () => {
  const toastErrorMock = vi.fn();

  vi.doMock("sonner", () => ({
    toast: {
      error: toastErrorMock,
    },
  }));

  const { toastError } = await import("~/lib/toast-error");

  toastError({
    error: {
      message: "Toast me",
    },
  });

  expect(toastErrorMock).toHaveBeenCalledWith("Toast me");
});

test("falls back when the error has no usable message", async () => {
  const toastErrorMock = vi.fn();

  vi.doMock("sonner", () => ({
    toast: {
      error: toastErrorMock,
    },
  }));

  const { toastError } = await import("~/lib/toast-error");

  toastError({ message: "" });

  expect(toastErrorMock).toHaveBeenCalledWith("Something went wrong");
});
