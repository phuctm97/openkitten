import { render } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { mockSonnerToast } from "~/test/components/auth/mock-better-auth-ui";

beforeEach(() => {
  vi.resetModules();
});

test("registers query and mutation error handlers with sonner", async () => {
  const toast = mockSonnerToast();
  const queryCacheConfig: {
    onError?: (error: unknown) => void;
  } = {};
  let mutationOnError:
    | ((error: Error & { error?: { message?: string } }) => void)
    | undefined;

  vi.doMock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
      getQueryCache: () => ({
        config: queryCacheConfig,
      }),
      setMutationDefaults: (
        _keys: unknown[],
        config: {
          onError: (error: Error & { error?: { message?: string } }) => void;
        },
      ) => {
        mutationOnError = config.onError;
      },
    }),
  }));

  const { ErrorToaster } = await import("~/components/auth/error-toaster");

  render(<ErrorToaster />);

  expect(queryCacheConfig.onError).toBeTypeOf("function");
  expect(mutationOnError).toBeTypeOf("function");

  queryCacheConfig.onError?.(new Error("Ignored query"));
  queryCacheConfig.onError?.({
    error: { message: "Query failed" },
  } as never);
  mutationOnError?.(new Error("Mutation failed"));
  mutationOnError?.(
    Object.assign(new Error("Mutation failed"), {
      error: { message: "Mutation exploded" },
    }),
  );

  expect(toast.toastError).toHaveBeenCalledWith("Query failed");
  expect(toast.toastError).toHaveBeenCalledWith("Mutation failed");
  expect(toast.toastError).toHaveBeenCalledWith("Mutation exploded");
});
