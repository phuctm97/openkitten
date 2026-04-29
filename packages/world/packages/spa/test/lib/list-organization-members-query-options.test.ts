import { expect, it, vi } from "vitest";

const authClientMock = vi.hoisted(() => ({
  organization: {
    listMembers: vi.fn(),
  },
}));

vi.mock("~/lib/auth-client", () => ({ authClient: authClientMock }));

const { listOrganizationMembersQueryOptions } = await import(
  "~/lib/list-organization-members-query-options"
);

it("disables the query when no organizationId is provided", () => {
  const options = listOrganizationMembersQueryOptions(undefined);
  expect(options.queryKey).toStrictEqual(["organizations", "members", null]);
  expect(options.enabled).toBe(false);
});

it("enables the query and exposes a stable key when an id is provided", () => {
  const options = listOrganizationMembersQueryOptions("org_1");
  expect(options.queryKey).toStrictEqual(["organizations", "members", "org_1"]);
  expect(options.enabled).toBe(true);
});

it("delegates to authClient.organization.listMembers with the abort signal", async () => {
  const options = listOrganizationMembersQueryOptions("org_1");
  const controller = new AbortController();
  authClientMock.organization.listMembers.mockResolvedValueOnce({
    members: [{ id: "m_1" }],
  });

  const result = await options.queryFn?.({
    queryKey: options.queryKey,
    signal: controller.signal,
    meta: undefined,
    client: undefined as never,
  });

  expect(result).toStrictEqual({ members: [{ id: "m_1" }] });
  expect(authClientMock.organization.listMembers).toHaveBeenCalledWith({
    query: { organizationId: "org_1" },
    fetchOptions: { signal: controller.signal, throw: true },
  });
});

it("throws when the queryFn runs without an organizationId", () => {
  const options = listOrganizationMembersQueryOptions(undefined);
  const controller = new AbortController();
  expect(() =>
    options.queryFn?.({
      queryKey: options.queryKey,
      signal: controller.signal,
      meta: undefined,
      client: undefined as never,
    }),
  ).toThrow("organizationId is required");
});
