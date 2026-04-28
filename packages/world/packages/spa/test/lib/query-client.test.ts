import { afterEach, beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

test("configures global query and mutation error handlers", async () => {
  const toastError = vi.fn();

  vi.doMock("~/lib/toast-error", () => ({
    toastError,
  }));

  const { queryClient } = await import("~/lib/query-client");
  const queryOnError = queryClient.getQueryCache().config.onError;
  const mutationOnError = queryClient.getDefaultOptions().mutations?.onError;

  expect(queryOnError).toBeTypeOf("function");
  expect(mutationOnError).toBeTypeOf("function");
  const mutationError = new Error("Mutation failed");

  queryOnError?.(
    {
      error: {
        message: "Query failed",
      },
    } as never,
    {} as never,
  );
  mutationOnError?.(mutationError, {} as never, {} as never, {} as never);
  mutationOnError?.(
    {
      error: {
        message: "Mutation exploded",
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
  );

  expect(toastError).toHaveBeenCalledWith(
    expect.objectContaining({
      error: {
        message: "Query failed",
      },
    }),
  );
  expect(toastError).toHaveBeenCalledWith(mutationError);
  expect(toastError).toHaveBeenCalledWith(
    expect.objectContaining({
      error: {
        message: "Mutation exploded",
      },
    }),
  );
});

test("passes every query and mutation error through the shared helper", async () => {
  const toastError = vi.fn();

  vi.doMock("~/lib/toast-error", () => ({
    toastError,
  }));

  const { queryClient } = await import("~/lib/query-client");
  const queryOnError = queryClient.getQueryCache().config.onError;
  const mutationOnError = queryClient.getDefaultOptions().mutations?.onError;

  queryOnError?.(new Error("Query fallback"), {} as never);
  queryOnError?.("not-an-error" as never, {} as never);
  mutationOnError?.(
    { error: {} } as never,
    {} as never,
    {} as never,
    {} as never,
  );

  expect(toastError).toHaveBeenCalledWith(new Error("Query fallback"));
  expect(toastError).toHaveBeenCalledWith("not-an-error");
  expect(toastError).toHaveBeenCalledWith({ error: {} });
  expect(toastError).toHaveBeenCalledTimes(3);
});
