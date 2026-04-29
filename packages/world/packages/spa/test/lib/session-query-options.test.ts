import { afterEach, expect, test, vi } from "vitest";

const sessionQueryOptionsMocks = vi.hoisted(() => ({
  authClient: {
    getSession: vi.fn(async () => ({ user: { id: "user-1" } })),
  },
}));

vi.mock("~/lib/auth-client", () => ({
  authClient: sessionQueryOptionsMocks.authClient,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("exposes the shared Better Auth UI session query key and fetcher", async () => {
  const { sessionQueryOptions } = await import("~/lib/session-query-options");

  expect(sessionQueryOptions.queryKey).toStrictEqual([
    "auth",
    "getSession",
    null,
  ]);
  expect(sessionQueryOptions.staleTime).toBe(60 * 1000);

  await sessionQueryOptions.queryFn?.({
    signal: AbortSignal.timeout(1_000),
    client: undefined as never,
    queryKey: sessionQueryOptions.queryKey,
    meta: undefined,
  });

  expect(sessionQueryOptionsMocks.authClient.getSession).toHaveBeenCalledWith({
    fetchOptions: { throw: true },
  });
});
