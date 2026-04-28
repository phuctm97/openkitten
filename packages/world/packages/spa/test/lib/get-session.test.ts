import { afterEach, expect, test, vi } from "vitest";

const getSessionMocks = vi.hoisted(() => ({
  fetchQuery: vi.fn(),
  sessionQueryOptions: { queryKey: ["auth", "getSession", null] },
}));

vi.mock("~/lib/query-client", () => ({
  queryClient: {
    fetchQuery: getSessionMocks.fetchQuery,
  },
}));

vi.mock("~/lib/session-query-options", () => ({
  sessionQueryOptions: getSessionMocks.sessionQueryOptions,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("delegates to queryClient.fetchQuery with the shared session query options", async () => {
  const session = { user: { id: "user-1" } };
  getSessionMocks.fetchQuery.mockResolvedValue(session);

  const { getSession } = await import("~/lib/get-session");

  await expect(getSession()).resolves.toBe(session);
  expect(getSessionMocks.fetchQuery).toHaveBeenCalledWith(
    getSessionMocks.sessionQueryOptions,
  );
});
