import { afterEach, beforeEach, expect, it, vi } from "vitest";

const queryClientMock = vi.hoisted(() => ({
  getQueryData: vi.fn(),
}));

const sessionQueryOptionsMock = vi.hoisted(() => ({
  queryKey: ["auth", "getSession", null] as const,
}));

vi.mock("~/lib/query-client", () => ({ queryClient: queryClientMock }));
vi.mock("~/lib/session-query-options", () => ({
  sessionQueryOptions: sessionQueryOptionsMock,
}));

const { getActiveOrganizationId } = await import(
  "~/lib/get-active-organization-id"
);

beforeEach(() => {
  queryClientMock.getQueryData.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

it("returns the active organization id when set in the session cache", () => {
  queryClientMock.getQueryData.mockReturnValueOnce({
    session: { activeOrganizationId: "org_42" },
  });
  expect(getActiveOrganizationId()).toBe("org_42");
  expect(queryClientMock.getQueryData).toHaveBeenCalledWith(
    sessionQueryOptionsMock.queryKey,
  );
});

it("returns undefined when activeOrganizationId is null in the cache", () => {
  queryClientMock.getQueryData.mockReturnValueOnce({
    session: { activeOrganizationId: null },
  });
  expect(getActiveOrganizationId()).toBeUndefined();
});

it("returns undefined when there is no cached session", () => {
  queryClientMock.getQueryData.mockReturnValueOnce(undefined);
  expect(getActiveOrganizationId()).toBeUndefined();
});

it("returns undefined when the cached session has no session field", () => {
  queryClientMock.getQueryData.mockReturnValueOnce({});
  expect(getActiveOrganizationId()).toBeUndefined();
});
