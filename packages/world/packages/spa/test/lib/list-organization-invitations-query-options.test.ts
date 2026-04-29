import { expect, it, vi } from "vitest";

const authClientMock = vi.hoisted(() => ({
  organization: {
    listInvitations: vi.fn(),
  },
}));

vi.mock("~/lib/auth-client", () => ({ authClient: authClientMock }));

const { listOrganizationInvitationsQueryOptions } = await import(
  "~/lib/list-organization-invitations-query-options"
);

it("disables the query when no organizationId is provided", () => {
  const options = listOrganizationInvitationsQueryOptions(undefined);
  expect(options.queryKey).toStrictEqual([
    "organizations",
    "invitations",
    null,
  ]);
  expect(options.enabled).toBe(false);
});

it("enables the query and exposes a stable key when an id is provided", () => {
  const options = listOrganizationInvitationsQueryOptions("org_1");
  expect(options.queryKey).toStrictEqual([
    "organizations",
    "invitations",
    "org_1",
  ]);
  expect(options.enabled).toBe(true);
});

it("delegates to authClient.organization.listInvitations with the abort signal", async () => {
  const options = listOrganizationInvitationsQueryOptions("org_1");
  const controller = new AbortController();
  authClientMock.organization.listInvitations.mockResolvedValueOnce([
    { id: "inv_1" },
  ]);

  const result = await options.queryFn?.({
    queryKey: options.queryKey,
    signal: controller.signal,
    meta: undefined,
    client: undefined as never,
  });

  expect(result).toStrictEqual([{ id: "inv_1" }]);
  expect(authClientMock.organization.listInvitations).toHaveBeenCalledWith({
    query: { organizationId: "org_1" },
    fetchOptions: { signal: controller.signal, throw: true },
  });
});

it("throws when the queryFn runs without an organizationId", () => {
  const options = listOrganizationInvitationsQueryOptions(undefined);
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
