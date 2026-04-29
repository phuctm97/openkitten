import { expect, it, vi } from "vitest";

const authClientMock = vi.hoisted(() => ({
  organization: {
    list: vi.fn(),
  },
}));

vi.mock("~/lib/auth-client", () => ({ authClient: authClientMock }));

const { listOrganizationsQueryOptions } = await import(
  "~/lib/list-organizations-query-options"
);

it("exposes a stable organizations list query key", () => {
  expect(listOrganizationsQueryOptions.queryKey).toStrictEqual([
    "organizations",
    "list",
  ]);
});

it("delegates to authClient.organization.list with the abort signal", async () => {
  const controller = new AbortController();
  authClientMock.organization.list.mockResolvedValueOnce([{ id: "org_1" }]);
  const result = await listOrganizationsQueryOptions.queryFn?.({
    queryKey: listOrganizationsQueryOptions.queryKey,
    signal: controller.signal,
    meta: undefined,
    client: undefined as never,
  });
  expect(result).toStrictEqual([{ id: "org_1" }]);
  expect(authClientMock.organization.list).toHaveBeenCalledWith({
    fetchOptions: { signal: controller.signal, throw: true },
  });
});
